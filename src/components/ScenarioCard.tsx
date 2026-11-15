import { useState } from "react";
import { X } from "@phosphor-icons/react";
import { isCustomScenario, resetScenario, saveScenario, scenarioOf, type Scenario } from "../data/crew.ts";
import { BASELINE_FIELDS, DAYS, EVENT_INFO, type SimEvent, type SimEventType } from "../sim/simulator.ts";
import type { CrewMember } from "../engine/types.ts";
import card from "./Card.module.css";
import s from "./ScenarioCard.module.css";

const MIN_JUDGED_DAY = 21; // the engine learns each person's normal from days 7-20
const words = (n: string) => n.trim().split(/\s+/);
const personOf = (m: CrewMember) => words(m.name).slice(-2).join(" ");
const titleOf = (m: CrewMember) => words(m.name).slice(0, -2).join(" ");
const firstOf = (m: CrewMember) => words(m.name).slice(-2)[0];
const num = (v: string) => (v.trim() === "" ? NaN : Number(v));
const within = (v: number, lo: number, hi: number) => Number.isFinite(v) && v >= lo && v <= hi;

/** Problems that stop a run, in plain words; empty when the scenario can be simulated */
function problems(sc: Scenario): string[] {
  const out: string[] = [];
  if (!within(sc.today, 1, DAYS) || !Number.isInteger(sc.today)) out.push(`Today must be a whole day from 1 to ${DAYS}.`);
  for (const m of sc.crew) {
    if (words(personOf(m)).length !== 2 || !/^[\p{L}' -]+$/u.test(personOf(m))) out.push(`Give ${firstOf(m)} a first and last name.`);
    if (!within(m.age, 21, 70)) out.push(`${firstOf(m)}'s age must be 21 to 70.`);
    for (const f of BASELINE_FIELDS) {
      const v = (m.baseline as Record<string, number>)[f.key];
      if (!within(v, f.min, f.max)) out.push(`${firstOf(m)}: ${f.label.toLowerCase()} must be ${f.min} to ${f.max} ${f.unit}.`);
    }
  }
  for (const e of sc.events) {
    const info = EVENT_INFO[e.type];
    if (!within(e.day, 1, DAYS) || !Number.isInteger(e.day)) out.push(`${info.label}: the day must be 1 to ${DAYS}.`);
    if (e.length !== undefined && (!within(e.length, 1, DAYS) || !Number.isInteger(e.length))) out.push(`${info.label}: the length must be 1 to ${DAYS} days.`);
    if (!within(e.strength, info.min, info.max)) out.push(`${info.label}: ${info.unit} must be ${info.min} to ${info.max}.`);
    if (e.type !== "solar_storm" && e.crewId === "all") out.push(`${info.label}: pick one astronaut.`);
  }
  return out;
}

/** Settings card: change who is on board and what happens to them, then simulate the 120 days again */
export function ScenarioCard({ onToday }: { onToday: (day: number) => void }) {
  const [sc, setSc] = useState<Scenario>(scenarioOf);
  const [open, setOpen] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [tried, setTried] = useState(false);
  const [custom, setCustom] = useState(isCustomScenario());
  const issues = problems(sc);

  const edit = (next: Scenario) => { setSc(next); setStatus(null); };
  const setMember = (id: string, patch: Partial<CrewMember>) =>
    edit({ ...sc, crew: sc.crew.map((m) => (m.id === id ? { ...m, ...patch } : m)) });
  const setBaseline = (id: string, key: string, v: number) =>
    edit({ ...sc, crew: sc.crew.map((m) => (m.id === id ? { ...m, baseline: { ...m.baseline, [key]: v } } : m)) });
  const setEvent = (id: string, patch: Partial<SimEvent>) =>
    edit({ ...sc, events: sc.events.map((e) => (e.id === id ? { ...e, ...patch } : e)) });
  const addEvent = (type: SimEventType) => {
    const e: SimEvent = type === "solar_storm"
      ? { id: crypto.randomUUID(), type, crewId: "all", day: 30, length: 2, strength: 10 }
      : type === "fluid_drop"
        ? { id: crypto.randomUUID(), type, crewId: sc.crew[0].id, day: 30, strength: 40 }
        : { id: crypto.randomUUID(), type, crewId: sc.crew[0].id, day: 30, strength: 3.5 };
    edit({ ...sc, events: [...sc.events, e] });
  };

  function run() {
    setTried(true);
    if (issues.length) return;
    saveScenario(sc);
    onToday(sc.today);
    setCustom(true);
    setStatus(`Simulated ${DAYS} days for ${sc.crew.map(firstOf).join(", ")}. Every page now uses this scenario.`);
  }
  function reset() {
    resetScenario();
    const fresh = scenarioOf();
    setSc(fresh);
    onToday(fresh.today);
    setCustom(false);
    setTried(false);
    setStatus("Back to the original demo data.");
  }

  const who = (e: SimEvent, allowAll: boolean) => (
    <select className={s.field} aria-label="Who" value={e.crewId} onChange={(ev) => setEvent(e.id, { crewId: ev.target.value })}>
      {allowAll && <option value="all">All crew</option>}
      {sc.crew.map((m) => <option key={m.id} value={m.id}>{firstOf(m)}</option>)}
    </select>
  );
  const box = (label: string, value: number | undefined, onChange: (v: number | undefined) => void, wide = false, step = 1) => (
    <input className={`${s.field} ${s.num} ${wide ? s.wide : ""}`} type="number" inputMode="decimal" step={step} aria-label={label}
      value={value === undefined || Number.isNaN(value) ? "" : value}
      onChange={(ev) => onChange(ev.target.value.trim() === "" ? undefined : Number(ev.target.value))} />
  );

  return (
    <section className={`${card.card} ${s.card}`} aria-labelledby="scenario-title">
      <div className={card.head}>
        <h2 id="scenario-title">Scenario</h2>
        {custom && <button type="button" onClick={reset}>Reset to original</button>}
      </div>

      <label className={s.today}>
        Today is day
        {box("Today, mission day", sc.today, (v) => edit({ ...sc, today: v ?? NaN }))}
      </label>
      {sc.today < MIN_JUDGED_DAY && <p className={s.note}>HALO learns each person's normal from days 7 to 20, so it can judge from day {MIN_JUDGED_DAY} on.</p>}

      <h3 className={s.sub}>Astronauts</h3>
      <ul className={s.crew}>
        {sc.crew.map((m) => (
          <li key={m.id}>
            <div className={s.member}>
              <input className={`${s.field} ${s.name}`} aria-label={`Name of ${firstOf(m)}`} value={personOf(m)}
                onChange={(ev) => setMember(m.id, { name: [titleOf(m), ev.target.value].filter(Boolean).join(" ") })} />
              <span className={s.role}>{m.role}</span>
              <button type="button" className={s.text} aria-expanded={open === m.id} onClick={() => setOpen(open === m.id ? null : m.id)}>
                {open === m.id ? "Done" : "Edit baseline"}
              </button>
            </div>
            {open === m.id && (
              <div className={s.baseline}>
                <label className={s.pair}><span>Age</span>
                  {box(`Age of ${firstOf(m)}`, m.age, (v) => setMember(m.id, { age: v ?? NaN }))}<small>years</small></label>
                <label className={s.pair}><span>Sex</span>
                  <select className={s.field} value={m.sex} onChange={(ev) => setMember(m.id, { sex: ev.target.value as CrewMember["sex"] })}>
                    <option value="F">Female</option><option value="M">Male</option>
                  </select><small /></label>
                {BASELINE_FIELDS.map((f) => (
                  <label key={f.key} className={s.pair}><span>{f.label}</span>
                    {box(`${f.label} of ${firstOf(m)}`, (m.baseline as Record<string, number>)[f.key], (v) => setBaseline(m.id, f.key, v ?? NaN), false, f.step)}
                    <small>{f.unit}</small></label>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>

      <h3 className={s.sub}>Events</h3>
      <ul className={s.events}>
        {sc.events.map((e) => (
          <li key={e.id} className={s.event}>
            {e.type === "solar_storm" && <>
              <b>Solar storm</b> hits {who(e, true)} on day {box("Storm day", e.day, (v) => setEvent(e.id, { day: v ?? NaN }))}
              for {box("Storm length in days", e.length, (v) => setEvent(e.id, { length: v }))} days,
              {box("Extra dose on day one, mSv", e.strength, (v) => setEvent(e.id, { strength: v ?? NaN }), false, 0.5)} extra mSv on day one
            </>}
            {e.type === "fluid_drop" && <>
              <b>Fluid drop:</b> {who(e, false)} drinks {box("Percent less fluid", e.strength, (v) => setEvent(e.id, { strength: v ?? NaN }))} % less
              from day {box("Start day", e.day, (v) => setEvent(e.id, { day: v ?? NaN }))}
              for {box("Length in days, empty means to the end", e.length, (v) => setEvent(e.id, { length: v }))} days
              {e.length === undefined && <span className={s.hint}>(empty: to the end)</span>}
            </>}
            {e.type === "short_night" && <>
              <b>Short night:</b> {who(e, false)} sleeps {box("Hours slept", e.strength, (v) => setEvent(e.id, { strength: v ?? NaN }), false, 0.1)} h
              on day {box("Day", e.day, (v) => setEvent(e.id, { day: v ?? NaN }))}, the day of a spacewalk
            </>}
            <button type="button" className={s.remove} aria-label={`Remove ${EVENT_INFO[e.type].label.toLowerCase()}`}
              onClick={() => edit({ ...sc, events: sc.events.filter((x) => x.id !== e.id) })}><X size={16} weight="bold" /></button>
          </li>
        ))}
        {!sc.events.length && <li className={s.note}>No events: a calm mission.</li>}
      </ul>
      <label className={s.add}>
        <span className={s.vh}>Add an event</span>
        <select className={s.field} value="" onChange={(ev) => ev.target.value && addEvent(ev.target.value as SimEventType)}>
          <option value="">+ Add an event</option>
          <option value="solar_storm">Solar storm</option>
          <option value="fluid_drop">Fluid drop</option>
          <option value="short_night">Short night before a spacewalk</option>
        </select>
      </label>

      <div className={s.actions}>
        <button type="button" className={s.cta} onClick={run}>Run simulation</button>
        <span className={s.note}>Takes about a second. Saved on this device{custom ? "" : ""}.</span>
      </div>
      {tried && issues.length > 0 && (
        <ul className={s.issues} role="alert">{issues.slice(0, 5).map((i) => <li key={i}>{i}</li>)}</ul>
      )}
      {status && <p className={s.status} role="status">{status}</p>}
      <p className={s.note}>Simulated data: published spaceflight rates plus our own demo parameters. Check-ins, tests and instrument readings stay on top of it.</p>
    </section>
  );
}
