// Coupled Risk Engine: drift scores in, named risks out.
//
//   import { evaluateRisks } from "../engine/risks.ts";
//   const risks = evaluateRisks(historyOf("C2"), 58, "mars_transit");
//   risks[0]  // worst risk first: { name, level: "Nominal" | "Watch" | "Act", action, contributors, ... }
//
// Pipeline: readings -> personal baseline bands -> drift scores (baseline.ts)
//           -> Gurman's 7 coupling rules (src/rules) -> named risks with a level.
//
// How a rule's score is built (default; a rule can override it, e.g. solar storm):
//   - take the rule's signals that are drifting (drift score >= 1.5)
//   - weighted average of their drift scores (capped at 6 so one huge value can't dominate)
//   - x coupling factor: +15% for each extra linked signal drifting together,
//     x0.6 if fewer than minLinked signals are drifting (a lone signal counts less)
// Level: Act if score >= 4 AND at least minLinked signals drift together; Watch if score >= 2.5.
// All thresholds are DEMO parameters.

import { computeBaselines, computeDrift, type Drift } from "./baseline.ts";
import type { Level, MissionProfile, Reading } from "./types.ts";
import { COUPLING_RULES } from "../rules/index.ts";
import type {
  Contributor,
  CouplingRule,
  RiskResult,
  RuleInput,
} from "../rules/types.ts";

export const DRIFTING_AT = 1.5; // DEMO: a signal counts as drifting from this drift score
export const WATCH_AT = 2.5; // DEMO
export const ACT_AT = 4; // DEMO
const MAX_SIGNAL_SCORE = 6;

const RANK: Record<Level, number> = { Nominal: 0, Watch: 1, Act: 2 };
const r1 = (x: number) => Math.round(x * 10) / 10;

function defaultScore(rule: CouplingRule, drift: Record<string, Drift>) {
  const contributors: Contributor[] = Object.keys(rule.signals)
    .filter((k) => drift[k] && drift[k].score > 0)
    .map((k) => ({ signal: k, label: drift[k].label, score: drift[k].score }))
    .sort((a, b) => b.score - a.score);
  const drifting = contributors.filter((c) => c.score >= DRIFTING_AT);
  const wsum = drifting.reduce((a, c) => a + rule.signals[c.signal], 0);
  const avg =
    wsum === 0
      ? 0
      : drifting.reduce(
          (a, c) =>
            a + rule.signals[c.signal] * Math.min(c.score, MAX_SIGNAL_SCORE),
          0,
        ) / wsum;
  const coupling =
    drifting.length >= rule.minLinked ? 1 + 0.15 * (drifting.length - 1) : 0.6;
  return { score: avg * coupling, contributors };
}

export function evaluateRule(
  rule: CouplingRule,
  inp: RuleInput,
  baselineDays: number,
): RiskResult {
  const { score, contributors } = rule.score
    ? rule.score(inp)
    : defaultScore(rule, inp.drift);
  const linked = contributors.filter((c) => c.score >= DRIFTING_AT).length;

  let level: Level = "Nominal";
  if (score >= ACT_AT && linked >= rule.minLinked) level = "Act";
  else if (score >= WATCH_AT) level = "Watch";

  // "Why is HALO unsure?" and how wide the score range is
  const uncertainty = [
    "Thresholds are demo parameters, not clinically validated.",
  ];
  let spread = 0.4;
  if (rule.needs?.length) {
    uncertainty.push(`Missing inputs: ${rule.needs.join(", ")}.`);
    spread += 0.3 * rule.needs.length;
  }
  if (baselineDays < 7) {
    uncertainty.push(`Only ${baselineDays} days of personal baseline so far.`);
    spread += 0.5;
  }

  return {
    ruleId: rule.id,
    name: rule.name,
    level,
    score: r1(score),
    range: [r1(Math.max(0, score - spread)), r1(score + spread)],
    contributors: contributors
      .slice(0, 4)
      .map((c) => ({ ...c, score: r1(c.score) })),
    linked,
    why: rule.why,
    action:
      level === "Act"
        ? rule.action.act
        : level === "Watch"
          ? rule.action.watch
          : "No action needed.",
    source: rule.source,
    uncertainty,
    bodyParts: rule.bodyParts,
  };
}

/**
 * All 7 named risks for one astronaut on one mission day, worst first.
 * `history` = that astronaut's readings (e.g. historyOf("C2")); only data up to `day` is used.
 */
export function evaluateRisks(
  history: Reading[],
  day: number,
  profile: MissionProfile = "mars_transit",
): RiskResult[] {
  const upTo = history
    .filter((r) => r.day <= day)
    .sort((a, b) => a.day - b.day);
  if (upTo.length === 0) return [];
  const today = upTo[upTo.length - 1];
  const bands = computeBaselines(upTo, day);
  const baselineDays = Object.values(bands)[0]?.nDays ?? 0;
  const drift = computeDrift(history, bands, day);
  return COUPLING_RULES.map((rule) =>
    evaluateRule(rule, { day, today, drift, profile }, baselineDays),
  ).sort((a, b) => RANK[b.level] - RANK[a.level] || b.score - a.score);
}
