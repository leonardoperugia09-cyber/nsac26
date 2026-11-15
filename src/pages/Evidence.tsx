import { useEffect, useState } from "react";
import { BookOpen, MagnifyingGlass } from "@phosphor-icons/react";
import { api } from "../shared/api.ts";
import bundled from "../../backend/resources/evidence.json";
import { More } from "../components/More.tsx";
import { References } from "../components/References";
import card from "../components/Card.module.css";
import { DATA_ROWS, NASA_DATA, RULES, TESTS_TEXT, IMAGE_CREDITS } from "../ui/evidenceData.ts";
import s from "./Evidence.module.css";

type Props = Record<string, never>;

type Source = {
  id: string;
  title: string;
  source_url: string;
  topics: string[];
  studied_population: string;
  supported_claims: string[];
  limitations: string[];
  review_status?: string;
  licence?: string;
  full_text?: boolean;
  hypotheses?: string[];
};

const topicName = (t: string) => t.replace(/_/g, " ");

/** Words crews use and words papers use: searching either finds both */
const SYNONYMS: string[][] = [
  ["kidney", "renal", "urine", "stone"],
  ["heart", "cardiac", "cardiovascular", "blood pressure"],
  ["bone", "skeletal", "skeleton"],
  ["muscle", "muscular", "skeletal muscle"],
  ["eye", "vision", "sans", "ocular"],
  ["sleep", "insomnia", "hypnotic", "circadian"],
  ["radiation", "dose", "msv", "radlab", "solar"],
  ["immune", "virus", "herpes", "infection"],
  ["medicine", "medication", "drug", "pill", "tablet", "pharmaceutical", "potency"],
  ["fluid", "hydration", "water"],
];
const expand = (word: string) => (word.length < 3 ? [word] : SYNONYMS.find((g) => g.some((s) => s.startsWith(word) || word.startsWith(s))) ?? [word]);

export function Evidence(_props: Props) {
  const [records, setRecords] = useState<Source[]>(bundled.records as Source[]);
  const [q, setQ] = useState("");
  const [online, setOnline] = useState(false);
  useEffect(() => {
    let live = true;
    api("/evidence")
      .then((r) => {
        const list = Array.isArray(r) ? r : r?.records;
        if (live && Array.isArray(list) && list.length) {
          setRecords(list);
          setOnline(true);
        }
      })
      .catch(() => {});
    return () => { live = false; };
  }, []);
  // Every word must match somewhere in the source (title, topics, findings, population, limits), with synonyms
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const shown = records.filter((r) => {
    const text = `${JSON.stringify(r)} ${r.topics.map(topicName).join(" ")}`.toLowerCase();
    return words.every((w) => expand(w).some((s) => text.includes(s)));
  });
  return (
    <div>
      <h1 className={s.title}>Evidence</h1>
      <div className={s.stack}>
        <section className={card.card} aria-labelledby="sources-h">
          <div className={card.head}>
            <h2 id="sources-h">Sources</h2>
            <span>{online ? "From the backend" : "Saved on this device"}</span>
          </div>
          <p className={s.p}>Summaries we wrote from each source. Domain review is still pending and nothing here is clinically approved.</p>
          <label className={s.search}>
            <span className={s.vh}>Search sources</span>
            <MagnifyingGlass size={18} aria-hidden="true" />
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search sources" />
          </label>
          <p className={s.count} aria-live="polite">{shown.length} of {records.length} sources</p>
          <div className={s.sources}>
            {shown.map((r) => (
              <article key={r.id} className={s.source}>
                <h3>{r.title}</h3>
                <p className={s.topics}>{r.topics.map(topicName).join(", ")}{r.licence ? ` · ${r.licence}` : ""}{r.full_text ? " · full text searchable by HALO" : ""}</p>
                <ul className={s.claims}>
                  {r.supported_claims.map((c) => <li key={c}>{c}</li>)}
                </ul>
                {(r.review_status ?? "").includes("pending") && <p className={s.pending}>Pending review</p>}
                <More label="Population and limitations">
                  <p className={s.p}><b>Studied population.</b> {r.studied_population}</p>
                  <ul className={s.claims}>
                    {r.limitations.map((c) => <li key={c}>{c}</li>)}
                  </ul>
                  {!!r.hypotheses?.length && <>
                    <p className={s.p}><b>Open questions, not established.</b></p>
                    <ul className={s.claims}>{r.hypotheses.map((c) => <li key={c}>{c}</li>)}</ul>
                  </>}
                </More>
                <a className={s.link} href={r.source_url} target="_blank" rel="noreferrer">Open original source</a>
              </article>
            ))}
            {shown.length === 0 && <p className={s.muted}>No source matches that search.</p>}
          </div>
        </section>

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
        {/* Gurman: every reference and credit in one numbered list, unchecked ones tagged "To verify" */}
        <References />
      </div>
    </div>
  );
}
