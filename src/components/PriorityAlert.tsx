import { useState } from "react";
import { Check, PaperPlaneTilt, Warning, WarningOctagon } from "@phosphor-icons/react";
import type { LinkedSeries, PriorityRisk, Task } from "../ui/viewTypes.ts";
import { easedToday } from "../ui/overviewData.ts";
import { joinAnd } from "../ui/text.ts";
import { LinkedSignalsChart } from "./LinkedSignalsChart";
import s from "./PriorityAlert.module.css";

type Props = { risk: PriorityRisk | null; series: LinkedSeries[]; today: number; delay: string | null; nextTask?: Task; flagged: string[]; done: string[]; onDone: (ids: string[]) => void };

/** The one loud thing on the Overview: what is linked, what it shows, what to do.
 *  A solid white card; at Watch or Act a solid state strip runs across its top (the alarm-panel pattern). */
export function PriorityAlert({ risk, series, today, delay, nextTask, flagged, done, onDone }: Props) {
  const [why, setWhy] = useState(false);
  if (!risk) {
    const one = flagged.length === 1;
    return (
      <section className={s.hero} aria-labelledby="risk-title">
        <p className={s.status}>{flagged.length ? "No linked risks" : "All normal"}</p>
        <h1 id="risk-title" className={s.title}>Nothing needs you today</h1>
        <p className={s.why}>
          {flagged.length
            ? `${joinAnd(flagged.map((n, i) => (i ? n.toLowerCase() : n)))} ${one ? "is" : "are"} outside your normal range, but nothing is linked to ${one ? "it" : "them"}. HALO keeps watching.`
            : "Every reading is inside your own normal range, and no linked risks are rising."}
        </p>
        {nextTask && <p className={s.next}>Next on your list: <b>{nextTask.label}</b>{nextTask.when ? `, ${nextTask.when.toLowerCase()}` : ""}</p>}
      </section>
    );
  }
  // Act eases to Watch once today's drinking is done; the readings themselves update tomorrow
  const level = risk.level === "act" && easedToday(risk, done) ? "watch" : risk.level;
  return (
    <section className={s.hero} aria-labelledby="risk-title">
      <div className={`${s.strip} ${level === "act" ? s.stripAct : s.stripWatch}`}>
        {level === "act" ? <WarningOctagon size={20} weight="fill" aria-hidden="true" /> : <Warning size={20} weight="fill" aria-hidden="true" />}
        <b>{level === "act" ? "Act now" : "Watch"}</b><span>since Day {risk.sinceDay}</span>
      </div>
      <h1 id="risk-title" className={s.title}>{level === "act" ? risk.actTitle ?? risk.title : risk.title}</h1>
      <p className={s.why}>{risk.short}</p>
      <div className={s.chart}>
        <LinkedSignalsChart series={series} eventDay={risk.eventDay} eventLabel={risk.eventLabel} today={today} />
      </div>
      {/* A real to-do: tick steps off; the big button is always the next step */}
      <div className={s.plan}>
        <div className={s.planHead}><h2>Today's plan</h2><span><span className={`mono ${done.length ? s.count : ""}`}>{done.length}</span> of {risk.plan.length} done</span></div>
        <ol className={s.steps}>
          {risk.plan.map((p) => {
            const isDone = done.includes(p.id);
            return (
              <li key={p.id}>
                <label className={`${s.step} ${isDone ? s.stepDone : ""}`}>
                  <input type="checkbox" checked={isDone} onChange={() => onDone(isDone ? done.filter((x) => x !== p.id) : [...done, p.id])} />
                  <span className={s.box} aria-hidden="true">{isDone && <Check size={14} weight="bold" />}</span>
                  <span>{p.label}<small>{p.when}</small></span>
                </label>
              </li>
            );
          })}
        </ol>
      </div>
      <div className={s.act}>
        {(() => {
          const next = risk.plan.find((p) => !done.includes(p.id));
          return next
            ? <button className={s.cta} onClick={() => onDone([...done, next.id])}><Check size={18} weight="bold" /><span key={next.id} className={s.ctaLabel}>{next.cta}</span></button>
            : <span className={s.allDone}><Check size={18} weight="bold" />Today's plan is done. HALO checks again tomorrow.</span>;
        })()}
          <button type="button" className={s.secondary} aria-expanded={why} aria-controls="why-more" onClick={() => setWhy(!why)}>Why these are linked</button>
      </div>
      {why && (
        <div id="why-more" className={s.whyMore}>
          <p>{risk.why}</p>
          {delay && <p className={s.queued}><PaperPlaneTilt size={16} />HALO queued a note for your flight surgeon. It reaches Houston in <span className="mono">{delay}</span></p>}
        </div>
      )}
    </section>
  );
}
