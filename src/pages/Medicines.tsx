import { useEffect, useMemo, useState } from "react";
import { Check, PaperPlaneTilt, Warning } from "@phosphor-icons/react";
import { Area, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import card from "../components/Card.module.css";
import { More } from "../components/More";
import { PageHero } from "../components/PageHero";
import { MISSION_PROFILE, historyOf, readingOn } from "../data/crew";
import { evaluateRisks } from "../engine/risks.ts";
import type { Level } from "../engine/types.ts";
import { AGE_AT_LAUNCH_DAYS, USP_LIMIT, potencyStatus, type PotencyForecast } from "../engine/potency.ts";
import { NORMAL_DOSE } from "../rules/solarStorm.ts";
import {
  CATEGORIES, HORIZON_DAY, MEDS, MED_BY_ID, STOCK,
  adherence, clockNow, lastSetDay, nextDose, pastState, potencyOf, runsOutDay, scheduleOf, statusOf, untilText,
  type Category, type MedDay, type MedInfo, type TodayStatus,
} from "../ui/medicinesData";
import s from "./Medicines.module.css";

type Props = { crewId: string; day: number; delay: string | null; today: MedDay; onChange: (d: MedDay) => void };

const RANK: Record<Level, number> = { Nominal: 0, Watch: 1, Act: 2 };
const SKIP_REASONS = ["Felt unwell", "Forgot until too late", "Ran out", "Flight surgeon said to"];
const NOTE_STARTERS = ["I need more of a medicine", "I think I have a side effect", "I have a question about my schedule"];
const HISTORY_DAYS = 14;

type KitStatus = "Below 90%" | "Runs out" | "Use first" | "Watch" | "Fine";
const STATUS_ORDER: KitStatus[] = ["Below 90%", "Runs out", "Use first", "Watch", "Fine"];

/** Onboard medicines, today's doses, adherence and notes to the flight surgeon. HALO never changes a dose. */
export function Medicines({ crewId, day, delay, today, onChange }: Props) {
  const [now, setNow] = useState(clockNow);
  useEffect(() => {
    const t = setInterval(() => setNow(clockNow()), 30_000);
    return () => clearInterval(t);
  }, []);

  const doses = scheduleOf(crewId);
  const risks = useMemo(() => evaluateRisks(historyOf(crewId), day, MISSION_PROFILE), [crewId, day]);
  const levelOf = (ruleId: string): Level => risks.find((r) => r.ruleId === ruleId)?.level ?? "Nominal";
  const cautionsOf = (m: MedInfo) => (m.cautions ?? []).filter((c) => RANK[levelOf(c.ruleId)] >= RANK[c.from]);

  const next = nextDose(crewId, today, now);
  const total = readingOn(crewId, day)?.radiation_mSv_total ?? 0;
  const stowed = day + AGE_AT_LAUNCH_DAYS;

  const take = (id: string) => onChange({ ...today, taken: { ...today.taken, [id]: clockNow() } });
  const undo = (id: string) => {
    const taken = { ...today.taken };
    const skipped = { ...today.skipped };
    delete taken[id];
    delete skipped[id];
    onChange({ ...today, taken, skipped });
  };
  const skip = (id: string, reason: string) => onChange({ ...today, skipped: { ...today.skipped, [id]: reason } });
  const logExtra = (medId: string) => onChange({ ...today, extra: [...today.extra, { medId, time: clockNow() }] });
  const queueNote = (text: string) => onChange({ ...today, notes: [...today.notes, { text, time: clockNow() }] });

  // Hero: the one thing to do on this page right now. Several overdue doses are handled together.
  const overdue = doses.filter((d) => statusOf(d, today, now) === "Overdue");
  const anyOverdue = overdue.length > 0;
  const nextName = next ? MED_BY_ID[next.dose.medId].name : "";
  const title = !next
    ? "Today's doses are done"
    : overdue.length > 1 ? `${overdue.length} doses are overdue`
    : next.status === "Overdue" ? `${nextName} was due at ${next.dose.time}`
    : next.status === "Due now" ? `${nextName} is due now`
    : `Next: ${nextName} at ${next.dose.time}`;
  const line = !next
    ? `All ${doses.length} scheduled ${doses.length === 1 ? "dose is" : "doses are"} recorded for Day ${day}.`
    : overdue.length > 1
      ? `${overdue.map((d) => `${MED_BY_ID[d.medId].name} at ${d.time}`).join(", ")}. Schedule set by your flight surgeon; HALO never changes doses.`
      : [`${next.dose.how}.`, next.status === "Later" ? `Due ${untilText(next.dose.time, now)}.` : "", "Schedule set by your flight surgeon; HALO never changes doses."].filter(Boolean).join(" ");
  const takeAllOverdue = () => {
    const t = clockNow();
    onChange({ ...today, taken: { ...today.taken, ...Object.fromEntries(overdue.map((d) => [d.id, t])) } });
  };

  return (
    <>
      <PageHero page="Medicines" state={anyOverdue ? "watch" : "normal"} title={title} line={line}
        aside={<span className={s.clock}>Ship time <span className="mono">{now}</span></span>}>
        {overdue.length > 1
          ? <button type="button" className={s.cta} onClick={takeAllOverdue}><Check size={18} weight="bold" />Mark all {overdue.length} as taken</button>
          : next && <button type="button" className={s.cta} onClick={() => take(next.dose.id)}><Check size={18} weight="bold" />Mark {nextName} as taken</button>}
      </PageHero>

      <div className={s.grid}>
        <TodayCard crewId={crewId} day={day} now={now} today={today} onTake={take} onUndo={undo} onSkip={skip}
          onExtra={logExtra} cautionsOf={cautionsOf} />
        <HistoryCard crewId={crewId} day={day} today={today} now={now} />
        <PharmacyCard crewId={crewId} day={day} total={total} stowed={stowed} cautionsOf={cautionsOf} />
        <NoteCard delay={delay} notes={today.notes} today={today} onQueue={queueNote} />
      </div>
    </>
  );
}

// ---- Today -----------------------------------------------------------------------------------------

type TodayProps = {
  crewId: string; day: number; now: string; today: MedDay;
  onTake: (id: string) => void; onUndo: (id: string) => void; onSkip: (id: string, reason: string) => void;
  onExtra: (medId: string) => void; cautionsOf: (m: MedInfo) => { text: string }[];
};

function TodayCard({ crewId, day, now, today, onTake, onUndo, onSkip, onExtra, cautionsOf }: TodayProps) {
  const [skipping, setSkipping] = useState<string | null>(null);
  const [asNeeded, setAsNeeded] = useState<string | null>(null);
  const doses = scheduleOf(crewId);
  const done = doses.filter((d) => today.taken[d.id] || today.skipped[d.id]).length;
  const prn = MEDS.filter((m) => m.prnPerWeek);
  const picked = asNeeded ? MED_BY_ID[asNeeded] : null;
  const pickedCautions = picked ? cautionsOf(picked) : [];

  return (
    <section className={card.card} aria-labelledby="today-h">
      <div className={card.head}><h2 id="today-h">Today, Day {day}</h2><span>{done} of {doses.length} done</span></div>
      <ul className={s.list}>
        {doses.map((d) => {
          const m = MED_BY_ID[d.medId];
          const st: TodayStatus = statusOf(d, today, now);
          const closed = st === "Taken" || st === "Skipped";
          return (
            <li key={d.id} className={`${s.dose} ${closed ? s.closed : ""}`}>
              <span className={`mono ${s.time}`}>{d.time}</span>
              <span className={s.what}>
                <b>{m.name}</b>
                <span>{d.how}</span>
                {d.setOnDay > 1 && d.setOnDay >= day - 7 && <span className={s.newTag}>New on Day {d.setOnDay}</span>}
              </span>
              <span className={s.right}>
                <StatusPill st={st} detail={st === "Taken" ? today.taken[d.id] : st === "Skipped" ? today.skipped[d.id] : undefined} />
                {closed
                  ? <button type="button" className={s.link} onClick={() => onUndo(d.id)}>Undo</button>
                  : (
                    <span className={s.btns}>
                      <button type="button" className={s.take} onClick={() => onTake(d.id)}>Take</button>
                      <button type="button" className={s.link} aria-expanded={skipping === d.id} onClick={() => setSkipping(skipping === d.id ? null : d.id)}>Skip</button>
                    </span>
                  )}
              </span>
              {skipping === d.id && !closed && (
                <div className={s.reasons} role="group" aria-label={`Why are you skipping ${m.name}?`}>
                  <span>Why?</span>
                  {SKIP_REASONS.map((r) => (
                    <button key={r} type="button" className={s.chip} onClick={() => { onSkip(d.id, r); setSkipping(null); }}>{r}</button>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <div className={s.prn}>
        <h3>Took something as needed?</h3>
        <div className={s.chips}>
          {prn.map((m) => (
            <button key={m.id} type="button" className={`${s.chip} ${asNeeded === m.id ? s.chipOn : ""}`} aria-pressed={asNeeded === m.id}
              onClick={() => setAsNeeded(asNeeded === m.id ? null : m.id)}>
              {m.name}{cautionsOf(m).length > 0 && <Warning size={14} weight="bold" className={s.chipWarn} aria-label="has a caution today" />}
            </button>
          ))}
        </div>
        {picked && (
          <div className={s.prnPick}>
            <p><b>{picked.name}</b>: {picked.purpose.toLowerCase()}.{picked.note ? ` ${picked.note}` : ""}</p>
            {pickedCautions.map((c) => <p key={c.text} className={s.caution}><Warning size={16} weight="bold" />{c.text}</p>)}
            <button type="button" className={s.take} onClick={() => { onExtra(picked.id); setAsNeeded(null); }}>Log one dose now</button>
          </div>
        )}
        {today.extra.length > 0 && (
          <ul className={s.extras}>
            {today.extra.map((x, i) => <li key={i}><span className="mono">{x.time}</span> {MED_BY_ID[x.medId].name}, as needed</li>)}
          </ul>
        )}
      </div>
    </section>
  );
}

function StatusPill({ st, detail }: { st: TodayStatus; detail?: string }) {
  const cls = st === "Overdue" ? s.pillWarn : st === "Due now" ? s.pillDue : st === "Taken" ? s.pillDone : s.pillQuiet;
  return (
    <span className={`${s.pill} ${cls}`}>
      {st === "Taken" && <Check size={13} weight="bold" />}
      <span>{st}{detail && (st === "Taken" ? <> <span className="mono">{detail}</span></> : `: ${detail.toLowerCase()}`)}</span>
    </span>
  );
}

// ---- Last 14 days ----------------------------------------------------------------------------------

function HistoryCard({ crewId, day, today, now }: { crewId: string; day: number; today: MedDay; now: string }) {
  const doses = scheduleOf(crewId);
  const days = Array.from({ length: HISTORY_DAYS }, (_, i) => day - HISTORY_DAYS + 1 + i);
  const pct = adherence(crewId, doses, day, 30);
  // One row per medicine; a medicine taken twice a day shows the worse of its two doses
  const meds = [...new Set(doses.map((d) => d.medId))];
  const cell = (medId: string, d: number) => {
    const mine = doses.filter((x) => x.medId === medId);
    if (d === day) {
      const st = mine.map((x) => statusOf(x, today, now));
      if (st.every((x) => x === "Taken")) return "taken";
      if (st.some((x) => x === "Skipped")) return "skipped";
      if (st.some((x) => x === "Overdue")) return "missed";
      return "pending";
    }
    const st = mine.map((x) => pastState(crewId, x, d));
    if (st.every((x) => x === "none")) return "none";
    return st.includes("missed") ? "missed" : "taken";
  };
  const LABEL: Record<string, string> = { taken: "taken", missed: "missed", skipped: "skipped", pending: "not taken yet", none: "not on schedule yet" };

  return (
    <section className={card.card} aria-labelledby="hist-h">
      <div className={card.head}>
        <h2 id="hist-h">Last {HISTORY_DAYS} days</h2>
        {pct !== null && <span><span className={`mono ${pct < 90 ? s.warnText : ""}`}>{pct}%</span> taken over 30 days</span>}
      </div>
      <div className={s.weeks}>
        {meds.map((id) => {
          const m = MED_BY_ID[id];
          const states = days.map((d) => cell(id, d));
          const n = states.filter((x) => x === "taken").length;
          const due = states.filter((x) => x !== "none" && x !== "pending").length;
          return (
            <div key={id}>
              <div className={s.weekHead}><b>{m.name}</b><span>{n} of {due}</span></div>
              <div className={s.squares}>
                {states.map((st, i) => (
                  <span key={days[i]} className={`${s.sq} ${s[st]}`} role="img" title={`Day ${days[i]}: ${LABEL[st]}`} aria-label={`Day ${days[i]}, ${LABEL[st]}`} />
                ))}
              </div>
            </div>
          );
        })}
        <div className={s.axis}><span className="mono">D{days[0]}</span><span className="mono">Today</span></div>
        <div className={s.legend} aria-hidden="true">
          <span><i className={`${s.sq} ${s.taken}`} />Taken</span>
          <span><i className={`${s.sq} ${s.missed}`} />Missed</span>
          <span><i className={`${s.sq} ${s.pending}`} />Not yet</span>
        </div>
      </div>
      <p className={s.small}>Schedule last changed on Day {lastSetDay(crewId)}.</p>
    </section>
  );
}

// ---- Onboard pharmacy and potency tracker -----------------------------------------------------------

type PharmProps = { crewId: string; day: number; total: number; stowed: number; cautionsOf: (m: MedInfo) => { text: string }[] };
const pct = (x: number) => Math.round(x);

function PharmacyCard({ crewId, day, total, stowed, cautionsOf }: PharmProps) {
  const [cat, setCat] = useState<Category | "All">("All");
  const [open, setOpen] = useState<string | null>(null);
  const doses = scheduleOf(crewId);
  const stock = STOCK[crewId] ?? STOCK.C1;
  const rate = NORMAL_DOSE[MISSION_PROFILE];

  const rows = MEDS.map((m) => {
    const f = potencyOf(m, day, total, rate);
    const perDay = doses.filter((d) => d.medId === m.id).length || (m.prnPerWeek ?? 0) / 7;
    const left = stock[m.id] ?? 0;
    const out = runsOutDay(left, perDay, day);
    // No resupply on a Mars transit: flag anything running out within about 6 months
    const ps = potencyStatus(f, day);
    const status: KitStatus = ps === "Below 90%" ? ps : out !== null && out - day < 180 ? "Runs out" : ps;
    return { m, f, left, out, status, cautions: cautionsOf(m) };
  })
    .filter((r) => r.left > 0)
    .sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) || (a.f.below90.mid ?? 9999) - (b.f.below90.mid ?? 9999));

  const shown = cat === "All" ? rows : rows.filter((r) => r.m.category === cat);
  const flagged = rows.filter((r) => r.status !== "Fine" && r.status !== "Watch").length;
  const cats = CATEGORIES.filter((c) => rows.some((r) => r.m.category === c));

  return (
    <section className={`${card.card} ${s.pharm}`} aria-labelledby="ph-h">
      <div className={card.head}>
        <h2 id="ph-h">Your onboard kit</h2>
        <span>{flagged ? `${flagged} of ${rows.length} need a plan` : `All ${rows.length} fine for now`}</span>
      </div>
      <div className={s.filters} role="group" aria-label="Filter by type">
        {(["All", ...cats] as const).map((c) => (
          <button key={c} type="button" className={`${s.chip} ${cat === c ? s.chipOn : ""}`} aria-pressed={cat === c} onClick={() => setCat(c)}>{c}</button>
        ))}
      </div>

      <table className={s.table}>
        <thead>
          <tr><th>Medicine</th><th>Left</th><th>Strength now</th><th>Drops below 90%</th><th>Status</th></tr>
        </thead>
        <tbody>
          {shown.map((r) => {
            const isOpen = open === r.m.id;
            const b = r.f.below90;
            return [
              <tr key={r.m.id} className={`${s.rowBtn} ${isOpen ? s.rowOpen : ""}`} onClick={() => setOpen(isOpen ? null : r.m.id)}>
                <th scope="row">
                  <button type="button" className={s.nameBtn} aria-expanded={isOpen} aria-controls={`med-${r.m.id}`}
                    onClick={(e) => { e.stopPropagation(); setOpen(isOpen ? null : r.m.id); }}>
                    {r.m.name}
                    {r.cautions.length > 0 && <Warning size={14} weight="bold" className={s.chipWarn} aria-label="has a caution today" />}
                  </button>
                  <span className={s.sub}>{r.m.category} · {r.m.location}</span>
                </th>
                <td>
                  <span className="mono">{r.left}</span>
                  <span className={s.sub}>{r.out === null ? "Lasts the mission" : <>Until Day <span className="mono">{r.out}</span></>}</span>
                </td>
                <td>
                  <span className={s.bar} aria-hidden="true"><i style={{ width: `${r.f.now.mid}%` }} className={r.f.now.mid < USP_LIMIT ? s.barWarn : ""} /></span>
                  <span className="mono">{pct(r.f.now.mid)}%</span>
                  <span className={s.sub}>Range <span className="mono">{pct(r.f.now.low)}-{pct(r.f.now.high)}%</span></span>
                </td>
                <td>
                  {b.mid === null ? <span>Lasts the round trip</span> : <span className="mono">Day {b.mid}</span>}
                  <span className={s.sub}>{rangeText(b)}</span>
                </td>
                <td>
                  <span className={r.status === "Fine" ? s.fine : s.warn}>{r.status}</span>
                  {r.cautions.length > 0 && <span className={`${s.sub} ${s.warn}`}>Ask before using</span>}
                </td>
              </tr>,
              isOpen && (
                <tr key={`${r.m.id}-d`} id={`med-${r.m.id}`} className={s.detailRow}>
                  <td colSpan={5}><MedDetail r={r} day={day} /></td>
                </tr>
              ),
            ];
          })}
        </tbody>
      </table>

      <More label="How strength and supply are estimated">
        <p>Each pack was made about <span className="mono">{AGE_AT_LAUNCH_DAYS}</span> days before launch, so it is <span className="mono">{stowed}</span> days old, and has absorbed <span className="mono">{Math.round(total)}</span> mSv in flight. From here HALO assumes <span className="mono">{rate}</span> mSv a day.</p>
        <p>Medicines lose strength slowly on Earth too. HALO takes the label date as the day a pack stored on Earth reaches 90%, which is cautious: in Wotring 2016, 5 of 9 medicines returned from the ISS still met the US standard 5-8 months after that date.</p>
        <p>Space speeds this up. In Du et al. 2011, after 28 months only 9 of the medicines stored on the ISS still met the US potency standard, against 17 of the same medicines kept on Earth; NASA's reanalysis puts breakdown at about 1.5 times faster in flight. HALO scales that by radiation dose, so deep space ages medicine faster than the ISS. Nobody has measured that part yet (Blue et al. 2019), so HALO shows a range: from no extra effect to twice as fast.</p>
        <p>Demo model, not a lab test. Shelf lives are typical label values. Supply counts your scheduled doses; as-needed medicines use a rough weekly estimate. With no resupply on a Mars transit, anything running out within about 6 months, or dropping below 90% within about 4 months, is flagged; within a year is marked Watch.</p>
      </More>
    </section>
  );
}

const rangeText = (b: PotencyForecast["below90"]) =>
  b.early === null ? "Even in the worst case it lasts"
    : b.late === null ? `Day ${b.early} at worst, after Day ${HORIZON_DAY} at best`
    : `Day ${b.early} to Day ${b.late}`;

type Row = { m: MedInfo; f: PotencyForecast; left: number; out: number | null; status: KitStatus; cautions: { text: string }[] };

function MedDetail({ r, day }: { r: Row; day: number }) {
  const data = useMemo(() => r.f.series.map((p) => ({ day: p.day, mid: +p.mid.toFixed(1), band: [+p.low.toFixed(1), +p.high.toFixed(1)] })), [r.f]);
  const lo = Math.max(0, Math.min(80, Math.floor((Math.min(...r.f.series.map((p) => p.low)) - 5) / 10) * 10));
  const plan = r.status === "Runs out" ? `Supply runs out around Day ${r.out}. Ask your flight surgeon how to plan for the rest of the mission.`
    : r.status === "Below 90%" ? "Weaker than the 90% standard. Ask your flight surgeon before relying on it."
    : r.status === "Use first" ? `Expected below 90% around Day ${r.f.below90.mid}. Use these packs before newer ones and tell your flight surgeon.`
    : r.status === "Watch" ? `Fine on the best estimate, but could drop below 90% as early as Day ${r.f.below90.early}.`
    : "Nothing to do.";
  return (
    <div className={s.detail}>
      <div className={s.detailText}>
        <p><b>{r.m.purpose}.</b>{r.m.note ? ` ${r.m.note}` : ""}</p>
        {r.cautions.map((c) => <p key={c.text} className={s.caution}><Warning size={16} weight="bold" />{c.text}</p>)}
        <p className={r.status === "Fine" || r.status === "Watch" ? s.small : s.warnText}>{plan}</p>
        <p className={s.small}>Typical label shelf life {r.m.shelfLifeMonths} months. Stored in {r.m.location}.</p>
      </div>
      <div className={s.chart} role="img" aria-label={`Estimated strength of ${r.m.name} from Day ${day} to Day ${HORIZON_DAY}, with its uncertainty range`}>
        <ResponsiveContainer width="100%" height={160}>
          <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
            <XAxis dataKey="day" type="number" domain={[day, HORIZON_DAY]} ticks={[day, 300, 600, HORIZON_DAY]} tickFormatter={(d) => `D${d}`}
              tick={{ fontSize: 11, fill: "var(--ink-2)" }} axisLine={false} tickLine={false} />
            <YAxis domain={[lo, 100]} ticks={[...new Set([lo, 80, 90, 100])].filter((v) => v >= lo)} tick={{ fontSize: 11, fill: "var(--ink-2)" }} axisLine={false} tickLine={false} unit="%" />
            <Area dataKey="band" stroke="none" fill="var(--ink)" fillOpacity={0.1} isAnimationActive={false} />
            <ReferenceLine y={USP_LIMIT} stroke="var(--watch-mark)" strokeDasharray="4 4" />
            {r.out !== null && <ReferenceLine x={r.out} stroke="var(--act)" strokeDasharray="4 4" label={{ value: `Runs out D${r.out}`, fontSize: 11, fill: "var(--act)", position: r.out > 600 ? "insideBottomRight" : "insideBottomLeft" }} />}
            <Tooltip formatter={(v, name) => name === "band" && Array.isArray(v) ? [`${v[0]}-${v[1]}%`, "Range"] : [`${v}%`, "Best estimate"]} labelFormatter={(d) => `Day ${d}`} />
            <Line type="monotone" dataKey="mid" stroke="var(--ink)" strokeWidth={2} dot={false} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ---- Note to the flight surgeon ------------------------------------------------------------------------

function NoteCard({ delay, notes, today, onQueue }: { delay: string | null; notes: MedDay["notes"]; today: MedDay; onQueue: (t: string) => void }) {
  const [text, setText] = useState("");
  // Skips and as-needed doses go into the note automatically, so the flight surgeon sees the whole day
  const auto = [
    ...Object.entries(today.skipped).map(([id, why]) => `Skipped ${MED_BY_ID[id.split("-")[0]]?.name ?? id} (${why.toLowerCase()})`),
    ...today.extra.map((x) => `Took ${MED_BY_ID[x.medId].name} as needed at ${x.time}`),
  ];
  return (
    <section className={`${card.card} ${s.note}`} aria-labelledby="note-h">
      <div className={card.head}><h2 id="note-h">Ask your flight surgeon</h2>{delay && <span>Reaches Houston in <span className="mono">{delay}</span></span>}</div>
      <div className={s.chips}>
        {NOTE_STARTERS.map((n) => <button key={n} type="button" className={s.chip} onClick={() => setText(n + ": ")}>{n}</button>)}
      </div>
      <label htmlFor="med-note" className={s.visuallyHidden}>Message to your flight surgeon</label>
      <textarea id="med-note" className={s.textarea} rows={3} value={text} placeholder="Write a question or request" onChange={(e) => setText(e.target.value)} />
      {auto.length > 0 && <p className={s.small}>Also included: {auto.join("; ")}.</p>}
      <button type="button" className={s.take} disabled={!text.trim()} onClick={() => { onQueue(text.trim()); setText(""); }}>
        <PaperPlaneTilt size={16} weight="bold" />Queue for flight surgeon
      </button>
      {notes.length > 0 && (
        <ul className={s.sent}>
          {notes.map((n, i) => <li key={i}><span className="mono">{n.time}</span> Queued: {n.text}</li>)}
        </ul>
      )}
    </section>
  );
}
