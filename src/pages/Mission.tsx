import { useEffect, useMemo, useState } from "react";
import { Line, LineChart, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { Segmented } from "../components/Segmented";
import { More } from "../components/More";
import { PageHero } from "../components/PageHero";
import card from "../components/Card.module.css";
import { MISSION_PROFILE, SIM, historyOf, readingOn } from "../data/crew";
import { readiness } from "../engine/assessment.ts";
import { api, query } from "../shared/api.ts";
import { PROFILES } from "../ui/missionData";
import type { MissionProfile } from "../engine/types.ts";
import s from "./Mission.module.css";

type Props = { crewId: string; day: number };
type Verdict = "Go" | "Caution" | "No-go" | "Insufficient data";
type RowGate = Exclude<Verdict, "Insufficient data"> | "No data";
type CrewRow = { id: string; name: string; status: string; concern: string | null };
type OutItem = { id: string; status: string; queuedAt: string; arrivalAt: string; earliestReplyAt?: string; local?: boolean };
type Rad = { status: string; snapshot: { value: number; unit: string; instrument: string; location: string; observed_at: string; source_url: string } };
type Draft = { id: string; key: string; local: boolean; concern: string | null };
type WhatIf = { id: number; fluid: number; now?: string; then?: string };

// The three readiness inputs, in the order readiness() returns them
const ROWS: Record<string, { label: string; short: string; unit: string; dec: number; phrase: string }> = {
  sleep_hours: { label: "Sleep last night", short: "Sleep", unit: "h", dec: 1, phrase: "lower than" },
  reaction_time_ms: { label: "Reaction time", short: "Reaction time", unit: "ms", dec: 0, phrase: "slower than" },
  radiation_mSv_today: { label: "Radiation today", short: "Radiation", unit: "mSv", dec: 2, phrase: "higher than" },
};
const STATUS_WORD: Record<string, string> = { queued_simulated: "Queued", in_transit_simulated: "On its way", delivered_simulated: "Arrived" };
const OUTBOX_KEY = "halo-outbox"; // on-device outbox, same key as the backend-less fallback in pr-5

const gateClass = (g: string) => (g === "Caution" ? s.caution : g === "No-go" ? s.nogo : g === "Go" ? "" : s.nodata);
const clock = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
// Whole seconds for the backend: "18 min" -> 1080, "1.3 s" -> 1, "Live link" -> 0
const delaySeconds = (d: string) => { const n = parseFloat(d); return Number.isNaN(n) ? 0 : Math.round(n * (d.endsWith("min") ? 60 : 1)); };
const priorityText = (p?: { name: string; level: string } | null) => (p ? `${p.name}, ${p.level}` : "Nothing flagged");

function localOutbox(crewId: string): OutItem[] {
  try {
    const rows: OutItem[] = JSON.parse(localStorage.getItem(OUTBOX_KEY) ?? "[]");
    return rows.filter((r: any) => r.crewId === crewId)
      .map((r) => ({ ...r, local: true, status: Date.now() >= Date.parse(r.arrivalAt) ? "delivered_simulated" : "in_transit_simulated" }));
  } catch { return []; }
}

export function Mission({ crewId, day }: Props) {
  const [profile, setProfile] = useState<MissionProfile>(MISSION_PROFILE);
  const p = PROFILES.find((x) => x.id === profile) ?? PROFILES[0];
  const sel = { crewId, day, profile };
  const reaches = p.delay === "Live link" ? "in seconds" : `in ${p.delay}`;

  const [draft, setDraft] = useState<Draft | null>(null);
  const [approved, setApproved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState("");
  const [outbox, setOutbox] = useState<OutItem[]>([]);
  const [serverDown, setServerDown] = useState(false);
  const [outboxOpen, setOutboxOpen] = useState(false);
  const [crew, setCrew] = useState<{ rows: CrewRow[]; offline: boolean } | null>(null);
  const [radiation, setRadiation] = useState<Rad | "loading" | "offline">("loading");
  const [fluid, setFluid] = useState(() => Math.round(readingOn(crewId, day)?.fluid_intake_ml ?? 1800)); // what-if starts from today's real intake
  const [whatIf, setWhatIf] = useState<WhatIf | null>(null);

  // Same readiness the backend serves (GET /api/readiness), worked out on this device so it never needs the server
  const ready = useMemo(() => readiness(historyOf(crewId), day, profile), [crewId, day, profile]);
  const status = ready.status as Verdict;
  const today = readingOn(crewId, day);
  const storm = !!today?.in_storm_shelter;
  const history = historyOf(crewId);

  // readiness() says No-go for a drift of 3 or a solar storm at Act; with no drift of 3, the storm is the cause
  const stormNoGo = status === "No-go" && !ready.inputs.some((i) => (i.reading?.score ?? 0) >= 3);
  const rows = ready.inputs.map(({ key, reading: d }) => {
    const gate: RowGate = !d ? "No data"
      : d.score >= 3 || (key === "radiation_mSv_today" && stormNoGo) ? "No-go"
      : d.score >= 2 ? "Caution" : "Go";
    return { key, ...ROWS[key], d, gate };
  });
  const bad = rows.filter((r) => r.gate === "Caution" || r.gate === "No-go");
  const fine = rows.filter((r) => r.gate === "Go").map((r) => r.short.toLowerCase());
  const reason = status === "Insufficient data"
    ? `No fresh reading for ${rows.filter((r) => !r.d).map((r) => r.short.toLowerCase()).join(" and ")}.`
    : bad.length === 0
      ? "" // the three Go rows already say it
      : `${bad.map((r) => (r.key === "radiation_mSv_today" && stormNoGo ? "Radiation is high because of the solar storm" : `${r.short} is ${r.phrase} your normal`)).join("; ")}${fine.length ? `; ${fine.join(" and ")} ${fine.length > 1 ? "are" : "is"} fine` : ""}.`;

  const eva = history.find((r) => r.eva_scheduled && r.day >= day);
  const until = eva ? eva.day - day : 0;
  const evaLine = eva
    ? `Spacewalk on Day ${eva.day}, ${until === 0 ? "today" : `in ${until} ${until === 1 ? "day" : "days"}`}`
    : "No spacewalk scheduled in the next 30 days";
  const verdict = status === "Caution" ? "Go with caution" : status;
  const title = status === "Insufficient data"
    ? (eva ? "Not enough data for your spacewalk" : "Not enough data for readiness today")
    : eva ? `${verdict} for your spacewalk` : `Readiness today: ${status}`;

  const series = history.filter((r) => r.day <= day && r.day > day - 30).map((r) => ({ day: r.day, mSv: r.radiation_mSv_today }));
  const stormInRange = series.some((r) => r.day === 40);
  const ticks = [0, 1, 2, 3].map((i) => series[Math.round(((series.length - 1) * i) / 3)]?.day).filter((d): d is number => d !== undefined);

  // Outbox: GET /api/outbox, plus anything saved on this device while the server was down
  async function refresh() {
    let rows: OutItem[] = [];
    try { rows = await api<OutItem[]>("/outbox?" + query(sel)); setServerDown(false); } catch { setServerDown(true); }
    setOutbox([...rows, ...localOutbox(crewId)].sort((a, b) => Date.parse(b.queuedAt) - Date.parse(a.queuedAt)));
  }
  useEffect(() => {
    let live = true;
    refresh();
    const timer = setInterval(refresh, 5000);
    api<{ crew: any[] }>("/crew-overview?" + new URLSearchParams({ day: String(day), profile }))
      .then((r) => live && setCrew({ offline: false, rows: r.crew.map((c) => ({ id: c.crewId, name: c.crew?.name ?? c.crewId, status: c.readiness.status, concern: priorityText(c.assessment.priority) })) }))
      .catch(() => live && setCrew({ offline: true, rows: SIM.crew.map((c) => ({ id: c.id, name: c.name, status: readiness(historyOf(c.id), day, profile).status, concern: null })) }));
    return () => { live = false; clearInterval(timer); };
  }, [crewId, day, profile]);
  useEffect(() => {
    api<Rad>("/radiation").then(setRadiation).catch(() => setRadiation("offline"));
  }, []);

  // Report flow: POST /api/reports/draft, explicit approval, then POST /api/reports/queue
  async function draftReport() {
    setBusy(true); setSent(""); setApproved(false);
    try {
      const r = await api("/reports/draft", { ...sel, purpose: "risk_review" });
      setDraft({ id: r.id, key: crypto.randomUUID(), local: false, concern: r.snapshot?.assessment?.priority?.name ?? null });
    } catch {
      setDraft({ id: crypto.randomUUID(), key: crypto.randomUUID(), local: true, concern: null });
    }
    setBusy(false);
  }
  async function queueReport() {
    if (!draft || !approved) return;
    setBusy(true);
    const secs = delaySeconds(p.delay);
    let arrival: string;
    try {
      if (draft.local) throw Error("Drafted on this device");
      const q = await api("/reports/queue", { reportId: draft.id, approved: true, delaySeconds: secs, idempotencyKey: draft.key });
      arrival = q.arrivalAt;
    } catch {
      const t = Date.now();
      const row = { id: draft.key, crewId, day, readiness: status, approved: true, transmitted: false,
        queuedAt: new Date(t).toISOString(), arrivalAt: new Date(t + secs * 1000).toISOString(), earliestReplyAt: new Date(t + secs * 2000).toISOString() };
      try {
        localStorage.setItem(OUTBOX_KEY, JSON.stringify([...JSON.parse(localStorage.getItem(OUTBOX_KEY) ?? "[]"), row]));
      } catch { /* storage blocked: the confirmation still shows */ }
      arrival = row.arrivalAt;
    }
    setSent(`Queued. It reaches Houston ${reaches}, at ${clock(arrival)}.`);
    setDraft(null); setApproved(false); setBusy(false);
    refresh();
  }

  // What-if: POST /api/what-if runs on a copy of the history; nothing real changes
  async function simulate() {
    try {
      const r = await api("/what-if", { ...sel, horizon: 7, changes: { fluid_intake_ml: fluid } });
      setWhatIf({ id: Date.now(), fluid, now: priorityText(r.baseline.priority), then: priorityText(r.scenario.priority) });
    } catch {
      setWhatIf({ id: Date.now(), fluid });
    }
  }

  const [latest, ...older] = outbox;
  const outRow = (o: OutItem) => (
    <>
      <p className={s.item}>Report for your flight surgeon <span className={s.status}>{STATUS_WORD[o.status] ?? "Queued"}</span></p>
      <p className={s.itemMeta}>
        Queued <span className="mono">{clock(o.queuedAt)}</span>, arrives <span className="mono">{clock(o.arrivalAt)}</span>
        {o.earliestReplyAt && <>, earliest reply <span className="mono">{clock(o.earliestReplyAt)}</span></>}
        {o.local && <>. Saved on this device</>}
      </p>
    </>
  );
  const rad = typeof radiation === "object" ? radiation : null;

  return (
    <>
      <PageHero page="Mission" state={status === "No-go" ? "act" : status === "Caution" ? "watch" : "normal"}
        title={title}
        line={`${evaLine}.${reason ? ` ${reason}` : ""}`}
        aside={<Segmented label="Mission profile" value={profile} onChange={setProfile} options={PROFILES.map((x) => ({ id: x.id, label: x.label }))} />} />

      <div key={profile} className={s.grid}>
        <section className={`${card.card} ${s.hero}`} aria-labelledby="gate-h">
          <div className={card.head}><h2 id="gate-h">{eva ? "Spacewalk readiness" : "Readiness today"}</h2></div>
          <table className={s.inputs}>
            <thead className={s.srOnly}><tr><th>Signal</th><th>Value</th><th>Your normal</th><th>Status</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key}>
                  <th scope="row">{r.label}</th>
                  <td><span className="mono">{r.d ? r.d.value.toFixed(r.dec) : "n/a"}</span> <span className={s.unit}>{r.unit}</span></td>
                  <td className={s.normal}>{r.d ? <>Your normal <span className="mono">{r.d.bandLo.toFixed(r.dec)} to {r.d.bandHi.toFixed(r.dec)}</span></> : ""}</td>
                  <td className={`${s.gateWord} ${gateClass(r.gate)}`}>{r.gate}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {draft && (
            <div className={s.draft}>
              <h3 className={s.sub3}>Draft for your flight surgeon</h3>
              <p className={s.draftLine}>
                Day {day} readiness: {status}.
                {draft.concern ? ` Top concern: ${draft.concern}.` : draft.local ? "" : " No pattern flagged."} It reaches Houston {reaches}.
              </p>
              <p className={s.note}>{draft.local ? "Drafted on this device. The full report needs the HALO server." : "Includes today's readings, your normal ranges and the full assessment."}</p>
              <label className={s.check}>
                <input type="checkbox" checked={approved} onChange={(e) => setApproved(e.target.checked)} />
                I reviewed this report and approve sending it
              </label>
            </div>
          )}
          <div className={s.act}>
            {draft
              ? <button type="button" className={s.cta} disabled={!approved || busy} onClick={queueReport}>Queue for Houston</button>
              : <button type="button" className={s.cta} disabled={busy} onClick={draftReport}>Draft report to Houston</button>}
            {draft && <button type="button" className={s.quiet} onClick={() => { setDraft(null); setApproved(false); }}>Discard draft</button>}
            <span className={s.confirm} role="status">{sent}</span>
          </div>
          {status !== "Go" && status !== "Insufficient data" && <p className={s.note}>{p.escalation}</p>}
          <p className={s.note}>Advisory only. Go is not clearance; a flight-authorized person decides.</p>
          <More label="How readiness is decided">
            <p>Sleep, reaction time and radiation are each compared with your own normal. A drift of 2 means Caution, 3 means No-go, and a solar storm alert means No-go. A missing reading means not enough data. Thresholds are demo parameters ({ready.ruleVersion}).</p>
            {(status === "Go" || status === "Insufficient data") && <p>{p.escalation}</p>}
          </More>
        </section>

        <section className={`${card.card} ${s.link}`} aria-labelledby="link-h">
          <div className={card.head}><h2 id="link-h">Earth link</h2></div>
          {p.delay === "Live link"
            ? <p className={s.big}>Live link to Houston</p>
            : <><p className={s.lead}>Houston hears you in</p><p className={`${s.big} mono`}>{p.delay}</p></>}
          {p.roundTrip && <p className={s.roundTrip}>Round trip <span className="mono">{p.roundTrip}</span></p>}
          <h3 className={s.sub2}>Outbox</h3>
          {latest ? outRow(latest) : <p className={s.itemMeta}>Nothing queued yet.</p>}
          {older.length > 0 && (
              <button type="button" className={s.secondary} aria-expanded={outboxOpen} onClick={() => setOutboxOpen((o) => !o)}>
                {outboxOpen ? "Close outbox" : "Open outbox"}
              </button>
          )}
          {outboxOpen && older.length > 0 && (
            <ul className={s.outList}>{older.map((o) => <li key={o.id}>{outRow(o)}</li>)}</ul>
          )}
          <p className={s.note}>Simulated link. Nothing leaves HALO.</p>
          {serverDown && <p className={s.note}>Needs the HALO server to sync. Reports wait on this device.</p>}
        </section>

        <section className={`${card.card} ${s.rad}`} aria-labelledby="rad-h">
          <div className={card.head}><h2 id="rad-h">Radiation</h2></div>
          <div className={s.radBody}>
            <div className={s.radFacts}>
              <div>
                <p className={s.label}>Today</p>
                <p className={s.value}><span className="mono">{today?.radiation_mSv_today.toFixed(2) ?? "n/a"}</span> <span className={s.unit}>mSv</span></p>
              </div>
              <div>
                <p className={s.label}>Mission total</p>
                <p className={s.value2}><span className="mono">{today ? Math.round(today.radiation_mSv_total) : "n/a"}</span> <span className={s.unit}>mSv</span></p>
              </div>
              <p className={s.ref}>{p.dose}</p>
              <p className={storm ? s.stormOn : s.stormOff}>{storm ? "Solar storm: stay in the shielded shelter" : "No solar storm alert"}</p>
            </div>
            <div className={s.chart} role="img" aria-label="Radiation per day over the last 30 days">
              <ResponsiveContainer width="100%" height={140}>
                <LineChart data={series} margin={{ top: 18, right: 12, bottom: 0, left: 12 }}>
                  <XAxis dataKey="day" type="number" domain={["dataMin", "dataMax"]} ticks={ticks} tickFormatter={(d) => `Day ${d}`}
                    axisLine={false} tickLine={false} tick={{ fontFamily: "var(--mono)", fontSize: 12, fill: "#555C6B" }} />
                  <YAxis hide domain={["auto", "auto"]} />
                  {stormInRange && <ReferenceLine x={40} stroke="#555C6B" strokeOpacity={0.4}
                    label={{ value: "Solar storm, Day 40", position: "top", fontSize: 12, fill: "#555C6B" }} />}
                  <Line dataKey="mSv" stroke="#555C6B" strokeWidth={1.75} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className={s.nasa}>
            <p className={s.label}>NASA instrument on the ISS</p>
            {rad ? (
              <>
                <p className={s.value2}><span className="mono">{rad.snapshot.value.toFixed(2)}</span> <span className={s.unit}>{rad.snapshot.unit.replace(/^u/, "µ")}</span></p>
                <p className={s.ref}>
                  {rad.snapshot.instrument}, {rad.snapshot.location.replace("ISS/", "")} module. {rad.status === "stale" ? "Last cached reading" : "Cached reading"} from{" "}
                  <span className="mono">{new Date(rad.snapshot.observed_at).toLocaleString([], { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" })} UTC</span>.
                </p>
                <More label="About this reading">
                  <p>Absorbed dose rate measured by the instrument, not your personal dose. HALO does not convert it to mSv.</p>
                  <p>Source: <a href={rad.snapshot.source_url} target="_blank" rel="noreferrer">NASA OSDR RadLab</a></p>
                </More>
              </>
            ) : <p className={s.ref}>{radiation === "loading" ? "Checking the HALO server." : "Needs the HALO server for the instrument reading."}</p>}
          </div>
        </section>

        <section className={card.card} aria-labelledby="crew-h">
          <div className={card.head}><h2 id="crew-h">Crew today</h2></div>
          {!crew ? <p className={s.note}>Checking the HALO server.</p> : (
            <>
              <ul className={s.crewList}>
                {crew.rows.map((c) => (
                  <li key={c.id}>
                    <span className={s.crewName}>{c.name}{c.id === crewId && <span className={s.you}> (you)</span>}</span>
                    <span className={`${s.gateWord} ${gateClass(c.status)}`}>{c.status}</span>
                    {c.concern && <span className={s.concern}>{c.concern}</span>}
                  </li>
                ))}
              </ul>
              <p className={s.note}>{crew.offline ? "Readiness worked out on this device. Top concerns need the HALO server." : "Demo ranking, not clinical triage."}</p>
            </>
          )}
        </section>

        <section className={`${card.card} ${s.whatif}`} aria-labelledby="wi-h">
          <div className={card.head}><h2 id="wi-h">What if</h2><span>Explore only</span></div>
          <p className={s.lead2}>Try a different daily fluid intake for the next 7 days. Your real data stays as it is.</p>
          <div className={s.wiRow}>
            <label className={s.field}>
              Daily fluid intake
              <span className={s.inputWrap}>
                <input type="number" className="mono" min={0} max={10000} step={100} value={fluid}
                  onChange={(e) => setFluid(Math.min(10000, Math.max(0, Number(e.target.value))))} />
                <span className={s.unit}>ml</span>
              </span>
            </label>
            <button type="button" className={s.outline} onClick={simulate}>Try 7 days</button>
          </div>
          {whatIf && (
            <div key={whatIf.id} className={s.result} role="status">
              <p className={s.eyebrow}>What-if only</p>
              {whatIf.then
                ? <>
                    <p>At <span className="mono">{whatIf.fluid}</span> ml a day, by Day {day + 7}: {whatIf.then}.</p>
                    <p className={s.note}>Today: {whatIf.now}. Keeps your latest readings fixed and changes only fluid intake. Not a forecast.</p>
                  </>
                : <p className={s.note}>Needs the HALO server. Your real data has not changed.</p>}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
