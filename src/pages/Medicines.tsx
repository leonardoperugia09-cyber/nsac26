import { useEffect, useState } from "react";
import { api, query } from "../shared/api.ts";
import { MedAdd, type NewMed } from "../components/MedAdd";
import card from "../components/Card.module.css";
import { More } from "../components/More";
import { PageHero } from "../components/PageHero";
import { readingOn } from "../data/crew";
import { type DoseState, type Med, PACKED_DAYS_BEFORE_LAUNCH, POTENCY, SET_ON_DAY, TODAY, WEEK, WEEK_DAYS, strengthOf, below90Day } from "../ui/medicinesData";
import s from "./Medicines.module.css";

type Props = { crewId: string; day: number };
type Adh = { day: number; status: string };
type Row = { id: string; time: string; name: string; how: string; status: "Taken" | "Due" | "As needed"; check?: { text: string; warn: boolean } };

const isTime = (t: string) => /^\d\d:\d\d$/.test(t);
const MOCK_IDS = TODAY.map((m) => m.id);
// Registers a surgeon-set medicine with the backend so a dose can be logged. Not shown as an added medicine.
const stub = (crewId: string, m: Med) => ({ id: m.id, crewId, name: m.name, scheduleReference: `Set by flight surgeon on Day ${SET_ON_DAY}`, scheduledTime: isTime(m.time) ? m.time : "00:00", expiresAt: "2099-12-31T00:00:00.000Z", storageComplete: true, provenance: "demo_schedule" });

export function Medicines({ crewId, day }: Props) {
  const key = "halo-medications-" + crewId;
  const [own, setOwn] = useState<any[]>([]);
  const [adh, setAdh] = useState<Record<string, Adh[]>>({});
  const [msg, setMsg] = useState("");
  const [last, setLast] = useState<string | null>(null);
  const total = readingOn(crewId, day)?.radiation_mSv_total ?? 0;
  const stowed = day + PACKED_DAYS_BEFORE_LAUNCH;

  const keep = (o: any[], a: Record<string, Adh[]>) => {
    setOwn(o); setAdh(a);
    try { localStorage.setItem(key, JSON.stringify({ own: o, adh: a })); } catch { /* storage full or blocked */ }
  };
  const fromDevice = () => {
    try {
      const v = JSON.parse(localStorage.getItem(key) ?? "{}");
      setOwn(Array.isArray(v.own) ? v.own : []); setAdh(v.adh ?? {});
    } catch { setOwn([]); setAdh({}); }
  };
  async function load() {
    try {
      const items: any[] = (await api("/medications?" + query({ crewId, day, profile: "mars_transit" }))).items ?? [];
      const a: Record<string, Adh[]> = {};
      items.forEach((m) => { a[m.id] = m.adherence ?? []; });
      keep(items.filter((m) => !MOCK_IDS.includes(m.id)), a);
    } catch { fromDevice(); }
  }
  useEffect(() => { load(); }, [crewId, day]);

  const statusOf = (id: string) => adh[id]?.find((a) => a.day === day)?.status;

  const rows: Row[] = [
    ...TODAY.map((m): Row => ({ ...m, status: statusOf(m.id) === "taken" ? "Taken" : m.status })),
    ...own.map((m): Row => {
      const expired = Date.parse(m.expiresAt) <= Date.now();
      const bits = [m.scheduleReference, `${expired ? "Expired" : "Expires"} ${m.expiresAt.slice(0, 10)}`, m.storageComplete ? "storage recorded" : "storage not recorded"];
      return { id: m.id, time: m.scheduledTime, name: m.name, how: bits.join(". "), status: statusOf(m.id) === "taken" ? "Taken" : "Due", check: { text: "", warn: expired || !m.storageComplete } };
    }),
  ].sort((x, y) => (isTime(x.time) ? x.time : "99").localeCompare(isTime(y.time) ? y.time : "99"));

  const due = rows.find((r) => r.status === "Due");

  async function record(id: string, status: "taken" | "not_recorded") {
    try {
      const m = TODAY.find((t) => t.id === id);
      if (m) await api("/medications", stub(crewId, m));
      await api("/adherence", { crewId, medicationId: id, day, status });
      await load();
      setMsg("");
    } catch {
      const rest = (adh[id] ?? []).filter((a) => a.day !== day);
      keep(own, { ...adh, [id]: status === "taken" ? [...rest, { day, status }] : rest });
      setMsg("Saved on this device. The backend is not reachable.");
    }
    setLast(status === "taken" ? id : null);
  }
  async function add(n: NewMed) {
    const m = { id: crypto.randomUUID(), crewId, name: n.name, scheduleReference: n.scheduleReference, scheduledTime: n.scheduledTime, expiresAt: new Date(n.expiry + "T00:00:00Z").toISOString(), storageComplete: false, provenance: "demo_schedule" };
    try {
      await api("/medications", m);
      await load();
      setMsg("Reference saved. No dose was created.");
    } catch {
      keep([...own, { ...m, adherence: [] }], adh);
      setMsg("Saved on this device. The backend is not reachable.");
    }
  }
  const dosesFor = (id: string, base?: DoseState[]): DoseState[] =>
    WEEK_DAYS.map((d, i) => {
      const st = adh[id]?.find((a) => a.day === d)?.status;
      if (st === "taken") return "taken";
      if (st === "missed") return "missed";
      if (d === day) return "pending";
      return base ? base[i] : "missed";
    });
  const weekRows = [
    ...WEEK.map((w) => {
      const m = TODAY.find((t) => t.name === w.name);
      return { name: w.name, doses: m && statusOf(m.id) === "taken" ? w.doses.map((d, i) => (i === 6 ? "taken" as DoseState : d)) : w.doses };
    }),
    ...own.map((m) => ({ name: m.name as string, doses: dosesFor(m.id) })),
  ];
  const undoName = last ? rows.find((r) => r.id === last)?.name : null;

  return (
    <>
      <PageHero page="Medicines" state="normal"
        title={due ? `${due.name} due at ${due.time}` : "Today's doses are taken"}
        line={`Set by your flight surgeon on Day ${SET_ON_DAY}. HALO never changes doses.`}>
        {due
          ? <button type="button" className={s.cta} onClick={() => record(due.id, "taken")}>Mark {due.name.toLowerCase()} as taken</button>
          : undoName && <button type="button" className={s.text} onClick={() => record(last!, "not_recorded")}>Undo {undoName.toLowerCase()}</button>}
        {due && undoName && <button type="button" className={s.text} onClick={() => record(last!, "not_recorded")}>Undo {undoName.toLowerCase()}</button>}
      </PageHero>

      {msg && <p role="status" className={s.msg}>{msg}</p>}

      <div className={s.grid}>
        <section className={`${card.card}`} aria-labelledby="today-h">
          <div className={card.head}><h2 id="today-h">Today</h2></div>
          <ul className={s.list}>
            {rows.map((m) => (
              <li key={m.id} className={s.row}>
                <span className={`mono ${s.time}`}>{m.time}</span>
                <span className={s.what}><b>{m.name}</b><span className={m.check?.warn ? s.warnLine : undefined}>{m.how}</span></span>
                <span className={m.status === "Due" ? s.due : s.state}>{m.status}</span>
              </li>
            ))}
          </ul>
          <MedAdd onAdd={add} />
        </section>

        <section className={card.card} aria-labelledby="week-h">
          <div className={card.head}><h2 id="week-h">Last 7 days</h2></div>
          <div className={s.weeks}>
            {weekRows.map((w) => {
              const doses = w.doses;
              const n = doses.filter((d) => d === "taken").length;
              return (
                <div key={w.name}>
                  <div className={s.weekHead}><b>{w.name}</b><span>{n} of 7 taken</span></div>
                  <div className={s.squares}>
                    {doses.map((d, i) => (
                      <div key={i} className={s.cell}>
                        <span className={`${s.sq} ${s[d]}`} role="img" aria-label={`Day ${WEEK_DAYS[i]}, ${d === "pending" ? "not taken yet" : d}`} />
                        <span className={`mono ${s.dayLabel}`}>D{WEEK_DAYS[i]}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className={`${card.card} ${s.pharm}`} aria-labelledby="ph-h">
          <div className={card.head}><h2 id="ph-h">Onboard pharmacy</h2></div>
          <table className={s.table}>
            <thead>
              <tr><th>Medicine</th><th>Estimated strength</th><th>Below 90% around</th><th>Note</th></tr>
            </thead>
            <tbody>
              {POTENCY.map((p) => {
                const st = strengthOf(p.k, p.r, stowed, total);
                const drop = below90Day(p.k, p.r, day, total);
                // No resupply on a Mars transit: flag anything dropping below 90% within about 6 months
                const note = st < 80 ? "Below 80%" : st < 90 || (drop !== null && drop - day < 180) ? "Use first" : "Fine";
                return (
                  <tr key={p.name}>
                    <th scope="row">{p.name}</th>
                    <td><span className="mono">{st}</span>%</td>
                    <td>{drop === null ? "Lasts the round trip" : <span className="mono">Day {drop}</span>}</td>
                    <td className={note === "Fine" ? s.fine : s.warn}>{note}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <More label="How strength is estimated">
            <p>Every medicine has been stowed <span className="mono">{stowed}</span> days and absorbed <span className="mono">{Math.round(total)}</span> mSv. Strength drops with time and radiation.</p>
            <p>Demo model shaped by Du et al. 2011: after 880 days in orbit only 31% of medicines passed potency tests, against 54% on Earth. Not a lab measurement. Future dose assumes 1.8 mSv per day in Mars cruise.</p>
          </More>
        </section>
      </div>
    </>
  );
}
