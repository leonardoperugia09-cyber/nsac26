import { useMemo, useState } from "react";
import { ArrowSquareOut } from "@phosphor-icons/react";
import card from "./Card.module.css";
import { AI_USE_STATEMENT, CATEGORIES, REFERENCES, type Category } from "../ui/referencesData.ts";
import s from "./References.module.css";

// Every reference in one numbered, linkable list. Edit src/ui/referencesData.ts to add more.
export function References() {
  const [filter, setFilter] = useState<Category | "All">("All");
  const rows = useMemo(() => REFERENCES.filter((r) => filter === "All" || r.category === filter), [filter]);
  const toVerify = REFERENCES.filter((r) => !r.checked).length;

  return (
    <section className={card.card} aria-labelledby="refs-h" id="references">
      <div className={card.head}><h2 id="refs-h">References and credits</h2></div>
      <p className={s.intro}>
        Every source HALO relies on, in one place. Numbers like [1] in the app point here.
        {toVerify > 0 && <> {toVerify} of {REFERENCES.length} are still being checked against the original.</>}
      </p>

      <div className={s.tabs} role="group" aria-label="Filter references">
        {(["All", ...CATEGORIES] as const).map((c) => (
          <button key={c} type="button" className={s.tab} aria-pressed={filter === c} onClick={() => setFilter(c)}>{c}</button>
        ))}
      </div>

      <ol className={s.list}>
        {rows.map((r) => (
          <li key={r.id} id={`ref-${r.id}`} value={r.id} className={s.item}>
            <span className={s.cite}>{r.citation}</span>
            <span className={s.supports}>Supports. {r.supports}. Used in {r.usedIn}.</span>
            <span className={s.meta}>
              {r.url
                ? <a href={r.url} target="_blank" rel="noreferrer noopener">Open source<ArrowSquareOut size={14} aria-hidden="true" /></a>
                : <span className={s.nolink}>No link yet</span>}
              {!r.checked && <span className={s.verify}>To verify</span>}
            </span>
          </li>
        ))}
      </ol>

      <h3 className={s.sub}>How AI was used</h3>
      <p className={s.ai}>{AI_USE_STATEMENT}</p>
      <h3 className={s.sub}>Limits</h3>
      <p className={s.ai}>Crew data is simulated. Coupling thresholds and the medicine radiation scaling are demo assumptions. HALO is a prototype and not a medical device.</p>
    </section>
  );
}
