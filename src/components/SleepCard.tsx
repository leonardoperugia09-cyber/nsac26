import { useMemo } from "react";
import { historyOf } from "../data/crew";
import { useDataRevision } from "../shared/useDataRevision.ts";
import { driftOn } from "../ui/systems";
import card from "./Card.module.css";
import s from "./SleepCard.module.css";

type Props = { crewId: string; day: number; onOpen: () => void };

/** Last night at a glance: hours against your own normal, the week as bars, sleep debt. All simulator fields. */
export function SleepCard({ crewId, day, onOpen }: Props) {
  const revision = useDataRevision();
  const m = useMemo(() => {
    const week = historyOf(crewId).filter((r) => r.day > day - 7 && r.day <= day);
    return { week, d: driftOn(crewId, day).sleep_hours };
  }, [crewId, day, revision]);
  const last = m.week[m.week.length - 1];
  if (!last || !m.d) return null;

  const { week, d } = m;
  const top = Math.max(9, ...week.map((r) => r.sleep_hours));
  const pct = (h: number) => `${(h / top) * 100}%`;
  const out = d.status !== "inside band";
  const line = out
    ? `Shorter than your normal. Aim for ${d.bandLo.toFixed(1)} h or more tonight.`
    : "Inside your normal.";

  return (
    <section className={card.card} aria-labelledby="sleep-title">
      <div className={card.head}>
        <h2 id="sleep-title">Last night</h2>
        <button onClick={onOpen}>Brain and sleep</button>
      </div>
      <div className={s.top}>
        <span className={`${s.big} ${out ? s.outInk : ""}`}>{last.sleep_hours.toFixed(1)}<small>h</small></span>
        <span className={s.normal}>Your normal <span className="mono">{d.bandLo.toFixed(1)}-{d.bandHi.toFixed(1)}</span> h</span>
      </div>
      <div className={s.bars} role="img" aria-label={`Sleep, last ${week.length} nights: ${week.map((r) => r.sleep_hours.toFixed(1)).join(", ")} hours`}>
        <span className={s.band} style={{ bottom: pct(d.bandLo), height: `calc(${pct(d.bandHi)} - ${pct(d.bandLo)})` }} />
        {week.map((r, i) => (
          <span key={r.day} className={`${s.bar} ${r.sleep_hours < d.bandLo ? s.low : ""} ${r === last ? s.last : ""}`}
            style={{ height: pct(r.sleep_hours), animationDelay: `${i * 20}ms` }} />
        ))}
      </div>
      <div className={s.days} aria-hidden="true">{week.map((r) => <span key={r.day}>D{r.day}</span>)}</div>
      <p className={`${s.line} ${out ? s.outInk : ""}`}>{line}</p>
      <p className={s.debt}>Sleep debt <span className="mono">{last.sleep_debt_h.toFixed(1)}</span> h{last.sleep_med_taken ? ". Took melatonin." : ""}</p>
    </section>
  );
}
