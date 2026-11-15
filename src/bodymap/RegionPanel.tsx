import { forwardRef } from "react";
import { BookOpen, Clock, Crosshair, Question, Warning, WarningOctagon, CheckCircle, X } from "@phosphor-icons/react";
import type { MissionProfile } from "../engine/types.ts";
import type {AssessedRisk as RiskResult} from "../engine/assessment.ts";
import { PROFILES } from "../ui/missionData.ts";
import { STALE_AFTER_DAYS, STATUS_TEXT, type Indicator, type RegionModel, type RegionStatus } from "./model.ts";
import { REGION_BY_ID, regionsForRisk } from "./regions.ts";
import s from "./RegionPanel.module.css";

const fmt = (v: number) => {
  const a = Math.abs(v);
  return a >= 100 ? v.toFixed(0) : a >= 10 ? v.toFixed(1) : v.toFixed(2);
};

export function StatusIcon({ status, size = 16 }: { status: RegionStatus; size?: number }) {
  const p = { size, weight: "bold" as const, "aria-hidden": true };
  if (status === "act") return <WarningOctagon {...p} weight="fill" />;
  if (status === "watch") return <Warning {...p} weight="fill" />;
  if (status === "stale") return <Clock {...p} />;
  if (status === "unknown") return <Question {...p} />;
  return <CheckCircle {...p} />;
}

const IND_TEXT: Record<Indicator["status"], string> = {
  inside: "Inside band",
  outside: "Outside band",
  far: "Far outside",
  unknown: "No reading",
  stale: "Stale",
  no_baseline: "No baseline",
};
const TREND_TEXT = { away_from_baseline: "Drifting away", toward_baseline: "Returning", steady: "Steady" } as const;
const LEVEL_CLASS = { Act: s.act, Watch: s.watch, Nominal: s.nominal } as const;

type Props = {
  region: RegionModel;
  profile: MissionProfile;
  highlight: string | null;
  onHighlight: (riskId: string | null) => void;
  onClose?: () => void; // bottom-sheet mode only
  titleId: string;
};

function Indicators({ region }: { region: RegionModel }) {
  const { def, indicators } = region;
  if (indicators.length === 0 && def.missingInputs.length === 0) return null;
  return (
    <div className={s.tableWrap}>
      <table className={s.table}>
        <thead>
          <tr>
            <th scope="col">Indicator</th>
            <th scope="col">Latest</th>
            <th scope="col">Your band</th>
            <th scope="col">Trend</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          {indicators.map((i) => (
            <tr key={i.key} className={s[`row_${i.status}`]}>
              <th scope="row">
                {i.label}
                {i.role === "driver" && <span className={s.tag}>driver</span>}
                {i.role === "raw" && <span className={s.tag}>raw</span>}
              </th>
              <td className="mono">
                {i.value === null ? "–" : <>{fmt(i.value)} <span className={s.unit}>{i.unit}</span></>}
                {i.day !== null && <span className={s.sub}>day {i.day}</span>}
              </td>
              <td className="mono">{i.band ? `${fmt(i.band[0])}–${fmt(i.band[1])}` : "–"}</td>
              <td>{i.trend ? TREND_TEXT[i.trend] : "–"}</td>
              <td className={s.indStatus}>{IND_TEXT[i.status]}</td>
            </tr>
          ))}
          {def.missingInputs.map((m) => (
            <tr key={m} className={s.row_missing}>
              <th scope="row">{m}</th>
              <td colSpan={3}>–</td>
              <td className={s.indStatus}>Not monitored</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RiskCard({ risk, highlight, onHighlight }: { risk: RiskResult; highlight: string | null; onHighlight: Props["onHighlight"] }) {
  const regions = regionsForRisk(risk.ruleId);
  const on = highlight === risk.ruleId;
  return (
    <li className={`${s.risk} ${risk.level==="Unknown"?s.unknown:LEVEL_CLASS[risk.level]}`}>
      <button type="button" className={s.riskBtn} aria-pressed={on} onClick={() => onHighlight(on ? null : risk.ruleId)}>
        <span className={s.riskHead}>
          <span className={s.riskName}>{risk.name}</span>
          <span className={s.level}>{risk.level}</span>
        </span>
        <span className={s.mech}><b>Shared mechanism:</b> {risk.why}</span>
        <span className={s.involves}>
          <Crosshair size={14} aria-hidden /> {on ? "Shown on map: " : "Show on map: "}
          {regions.map((r) => REGION_BY_ID[r].name).join(" · ")}
        </span>
      </button>
      <dl className={s.riskMeta}>
        <div><dt>Score</dt><dd className="mono">{risk.score??"unavailable"} <span className={s.sub}>demo index; not a probability</span></dd></div>
        <div>
          <dt>Contributors</dt>
          <dd>{risk.contributors.length ? risk.contributors.map((c) => `${c.label} (${c.score})`).join(", ") : "None drifting"}</dd>
        </div>
      </dl>
    </li>
  );
}

export const RegionPanel = forwardRef<HTMLDivElement, Props>(function RegionPanel({ region, profile, highlight, onHighlight, onClose, titleId }, ref) {
  const { def, status, risks } = region;
  const active = risks.filter((r) => r.level !== "Nominal");
  const quiet = risks.filter((r) => r.level === "Nominal");
  const escalation = PROFILES.find((p) => p.id === profile)?.escalation;
  const sources = [...new Set([...def.sources, ...risks.map((r) => r.source)])];
  const dataGaps = [
    ...def.missingInputs.map((m) => `Not monitored: ${m}.`),
    ...(region.staleInputs.length ? [`Stale (older than ${STALE_AFTER_DAYS} days, demo): ${region.staleInputs.join(", ")}.`] : []),
    ...(region.unknownInputs.length ? [`No usable reading: ${region.unknownInputs.join(", ")}.`] : []),
  ];

  return (
    <div className={s.panel} ref={ref}>
      {/* A. Overview */}
      <header className={s.head}>
        <div className={s.titleRow}>
          <h2 id={titleId} className={s.title}>{def.name}</h2>
          {onClose && (
            <button type="button" className={s.close} onClick={onClose} aria-label="Close region details">
              <X size={20} aria-hidden />
            </button>
          )}
        </div>
        <p className={`${s.pill} ${s[status]}`}><StatusIcon status={status} /> {STATUS_TEXT[status]}</p>
        <p className={s.lead}>{def.plainExplanation}</p>
        <p className={s.meta}>
          {def.signalIds.length === 0
            ? "Not directly monitored."
            : `${region.outside} of ${region.scored} indicators outside your personal baseline.`}
        </p>
      </header>

      {/* B. Indicators */}
      <section className={s.section} aria-labelledby={`${titleId}-ind`}>
        <h3 id={`${titleId}-ind`}>Indicators</h3>
        <Indicators region={region} />
      </section>

      {/* C. Connected coupled risks */}
      <section className={s.section} aria-labelledby={`${titleId}-risk`}>
        <h3 id={`${titleId}-risk`}>Connected risks</h3>
        {risks.length === 0 ? (
          <p className={s.muted}>No coupled risk rule covers this region yet.</p>
        ) : (
          <>
            <p className={s.note}>One mechanism can reach several organs. A coupled risk is one problem shown in every place it touches, not separate problems.</p>
            {active.length > 0 && (
              <ul className={s.risks}>
                {active.map((r) => <RiskCard key={r.ruleId} risk={r} highlight={highlight} onHighlight={onHighlight} />)}
              </ul>
            )}
            {quiet.length > 0 && (
              <details className={s.quiet}>
                <summary>{active.length ? "Also linked, currently nominal" : "Linked risks, all nominal"} ({quiet.length})</summary>
                <ul className={s.risks}>
                  {quiet.map((r) => <RiskCard key={r.ruleId} risk={r} highlight={highlight} onHighlight={onHighlight} />)}
                </ul>
              </details>
            )}
          </>
        )}
      </section>

      {/* D. Why it matters in space */}
      <section className={s.section} aria-labelledby={`${titleId}-why`}>
        <h3 id={`${titleId}-why`}>Why it matters in space</h3>
        <p>{def.whySpace}</p>
      </section>

      {/* E. Action */}
      <section className={s.section} aria-labelledby={`${titleId}-act`}>
        <h3 id={`${titleId}-act`}>What to do</h3>
        {active.length === 0 ? (
          <div className={s.action}>
            <p className={s.what}>{status === "unknown" || status === "stale" ? "HALO cannot judge this region from current data." : "No action needed today."}</p>
            {dataGaps.length > 0 && (
              <div className={s.unsure}>
                <h4>Why HALO is unsure</h4>
                <ul>{dataGaps.map((u) => <li key={u}>{u}</li>)}</ul>
              </div>
            )}
          </div>
        ) : (
          active.map((r) => (
            <div key={r.ruleId} className={`${s.action} ${(r.level === "Unknown" ? "" : LEVEL_CLASS[r.level])}`}>
              <p className={s.actionFor}>{r.name} · {r.level}</p>
              <dl className={s.actionList}>
                <div><dt>What</dt><dd className={s.what}>{r.action}</dd></div>
                <div><dt>Why</dt><dd>{r.why}</dd></div>
                {escalation && <div><dt>Escalation</dt><dd>{r.level === "Act" ? "Tell the crew medical officer. " : "If this reaches Act: "}{escalation}</dd></div>}
              </dl>
              <div className={s.unsure}>
                <h4>Why HALO is unsure</h4>
                <ul>{[...r.uncertainty, ...dataGaps].map((u) => <li key={u}>{u}</li>)}</ul>
              </div>
            </div>
          ))
        )}
      </section>

      {/* F. Evidence */}
      <section className={s.section} aria-labelledby={`${titleId}-src`}>
        <h3 id={`${titleId}-src`}>Evidence</h3>
        <ul className={s.sources}>
          {sources.map((x) => <li key={x}><BookOpen size={14} aria-hidden /> {x}</li>)}
        </ul>
      </section>

      <p className={s.disclaimer}>Decision support on simulated data. HALO does not diagnose and never gives drug doses.</p>
    </div>
  );
});
