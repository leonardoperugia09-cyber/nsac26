import { useEffect, useState } from "react";
import { api } from "../shared/api.ts";
import source from "../../backend/resources/evidence.json";
import s from "../shared/Workbench.module.css";
export function EvidenceRegistry() {
  const [records, setRecords] = useState<any[]>(source.records);
  const [q, setQ] = useState("");
  const [mode, setMode] = useState("bundled offline");
  useEffect(() => {
    api("/evidence")
      .then((r) => {
        setRecords(r);
        setMode("backend registry");
      })
      .catch(() => {});
  }, []);
  return (
    <>
      <h1 className={s.title} id="evidence">
        Evidence
      </h1>
      <p className={s.intro}>
        Authored summaries with source populations and limits. Pending domain
        review; no clinical approval. Source: {mode}.
      </p>
      <label className={s.field}>
        Find a source
        <input value={q} onChange={(e) => setQ(e.target.value)} />
      </label>
      <div className={s.grid}>
        {records
          .filter((e) =>
            JSON.stringify(e).toLowerCase().includes(q.toLowerCase()),
          )
          .map((e) => (
            <article className={s.panel} key={e.id}>
              <h2>{e.title}</h2>
              <a href={e.source_url} target="_blank" rel="noreferrer">
                Open original source
              </a>
              <p>{e.studied_population}</p>
              <ul>
                {e.supported_claims.map((c: string) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
              <h3>Limits</h3>
              <ul>
                {e.limitations.map((c: string) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </article>
          ))}
      </div>
    </>
  );
}
