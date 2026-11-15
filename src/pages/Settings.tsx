import card from "../components/Card.module.css";
import { InstrumentsCard } from "../components/InstrumentsCard";
import s from "./Settings.module.css";

export type Look = "field" | "plain";

const LOOKS: { id: Look; label: string; note: string }[] = [
  {
    id: "field",
    label: "Mars",
    note: "White cards and glass over a warm Mars orange background.",
  },
  {
    id: "plain",
    label: "White page",
    note: "Light grey cards on a white page, no orange background.",
  },
];

const SCENARIOS = [
  { label: "Today", note: "Marco, day 58", crewId: "C2", day: 58 },
  { label: "Before the hydration drop", note: "Marco, day 50", crewId: "C2", day: 50 },
  { label: "Hydration pattern", note: "Marco, day 60", crewId: "C2", day: 60 },
  { label: "Radiation event", note: "Aiko, day 40", crewId: "C1", day: 40 },
  { label: "Readiness event", note: "Lena, day 70", crewId: "C3", day: 70 },
];

export function Settings({
  look,
  onLook,
  crewId,
  day,
  onScenario,
}: {
  look: Look;
  onLook: (l: Look) => void;
  crewId: string;
  day: number;
  onScenario: (crewId: string, day: number) => void;
}) {
  return (
    <>
      <h1 className={s.title}>Settings</h1>
      <section
        className={`${card.card} ${s.group}`}
        aria-labelledby="look-title"
      >
        <div className={card.head}>
          <h2 id="look-title">Appearance</h2>
        </div>
        <div
          role="radiogroup"
          aria-labelledby="look-title"
          className={s.options}
        >
          {LOOKS.map((o) => (
            <label key={o.id} className={s.option}>
              <input
                type="radio"
                name="look"
                value={o.id}
                checked={look === o.id}
                onChange={() => onLook(o.id)}
              />
              <span>
                <b>{o.label}</b>
                <small>{o.note}</small>
              </span>
            </label>
          ))}
        </div>
      </section>
      <InstrumentsCard crewId={crewId} day={day} />
      {/* Manar's scenarios: jump to a day in the simulated data and watch the engine react */}
      <section className={`${card.card} ${s.group} ${s.server}`} aria-labelledby="scenario-title">
        <div className={card.head}><h2 id="scenario-title">Demo scenarios</h2><span>Day {day}</span></div>
        <div className={s.scenarios}>
          {SCENARIOS.map((x) => (
            <button key={x.label} className={`${s.scenario} ${x.crewId === crewId && x.day === day ? s.current : ""}`}
              aria-pressed={x.crewId === crewId && x.day === day} onClick={() => onScenario(x.crewId, x.day)}>
              <b>{x.label}</b><small>{x.note}</small>
            </button>
          ))}
        </div>
        <p className={s.note}>Fictional crew data. Every screen recomputes from the readings up to the chosen day.</p>
      </section>
      {/* Manar's backend: only needed when the HALO server runs with HALO_API_TOKEN set */}
      <section className={`${card.card} ${s.group} ${s.server}`} aria-labelledby="server-title">
        <div className={card.head}><h2 id="server-title">HALO server</h2></div>
        <label className={s.field} htmlFor="server-token">Server token, optional</label>
        <input id="server-token" className={s.input} type="password" autoComplete="off"
          defaultValue={sessionStorage.getItem("halo-api-token") ?? ""}
          onChange={(e) => sessionStorage.setItem("halo-api-token", e.target.value)} />
        <p className={s.note}>Only needed when the on-board server asks for one. Kept for this session only.</p>
      </section>
    </>
  );
}
