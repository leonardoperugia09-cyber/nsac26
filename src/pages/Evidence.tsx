import { BookOpen } from "@phosphor-icons/react";
import card from "../components/Card.module.css";
import { DATA_ROWS, NASA_DATA, RULES, TESTS_TEXT, IMAGE_CREDITS } from "../ui/evidenceData.ts";
import { References } from "../components/References";
import s from "./Evidence.module.css";

type Props = Record<string, never>;

export function Evidence(_props: Props) {
  return (
    <div>
      <h1 className={s.title}>Evidence</h1>
      <div className={s.stack}>
        <section className={card.card} aria-labelledby="rules-h" id="evidence">
          <div className={card.head}><h2 id="rules-h">Coupling rules</h2></div>
          <div className={s.rules}>
            {RULES.map((r) => (
              <div key={r.name} className={s.rule}>
                <h3>{r.name}</h3>
                <p className={s.muted}>Combines: {r.combines}</p>
                <p>Why they link: {r.why}</p>
                <p>Action: {r.action}</p>
                <div className={s.src}><BookOpen size={16} />{r.source}</div>
              </div>
            ))}
          </div>
          <p className={s.note}>All thresholds are demo parameters and are labelled in the code.</p>
        </section>

        <div className={s.grid}>
          <section className={card.card} aria-labelledby="data-h">
            <div className={card.head}><h2 id="data-h">Real and simulated data</h2></div>
            <table className={s.table}>
              <caption className={s.vh}>Which data is real and which is simulated</caption>
              <thead><tr><th scope="col">Data</th><th scope="col">Status</th><th scope="col">Source</th></tr></thead>
              <tbody>
                {DATA_ROWS.map((r) => (
                  <tr key={r.data}><td>{r.data}</td><td>{r.status}</td><td>{r.source}</td></tr>
                ))}
              </tbody>
            </table>
          </section>
          <div className={s.col}>
            <section className={card.card} aria-labelledby="tests-h">
              <div className={card.head}><h2 id="tests-h">AI medical officer tests</h2></div>
              <p className={s.p}>{TESTS_TEXT}</p>
              <p className={s.status}>Not run yet</p>
            </section>
            <section className={card.card} aria-labelledby="nasa-h">
              <div className={card.head}><h2 id="nasa-h">NASA data we use</h2></div>
              <ul className={s.list}>
                {NASA_DATA.map((n) => (
                  <li key={n.name}><b>{n.name}</b><span>{n.use}</span></li>
                ))}
              </ul>
            </section>
            <section className={card.card} aria-labelledby="img-h">
              <div className={card.head}><h2 id="img-h">Body map images</h2></div>
              <ul className={s.list}>
                {IMAGE_CREDITS.map((n) => (
                  <li key={n.name}><b>{n.name}</b><span>{n.use}</span></li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      </div>
      <div className={s.stack} style={{ marginTop: 16 }}><References /></div>
    </div>
  );
}
