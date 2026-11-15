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
  // Inputs the rule wants count as missing only until the astronaut logs them
  const stillMissing = rule.inputs?.every((i) => inp.provided?.has(i)) ? [] : (rule.needs ?? []);
  if (stillMissing.length) {
    uncertainty.push(`Missing inputs: ${stillMissing.join(", ")}.`);
    spread += 0.3 * stillMissing.length;
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
/** What the astronaut logged today besides readings: ticked symptoms and the vision self-report (1-5 clarity) */
export type LoggedInputs = { symptoms?: string[]; vision_score?: number };

/** Keys of logged inputs; they are not readings, so baselines, charts and persistence checks skip them */
export const isInputKey = (k: string) => k.startsWith("symptom_") || k === "vision_selfreport" || k === "workload_1to5";

const SYMPTOM_LABEL: Record<string, string> = {
  headache: "Headache logged",
  puffy_face: "Puffy face logged",
  blurred_vision: "Blurred vision logged",
  cold_sore: "Cold sore logged",
  skin_symptoms: "Skin problem logged",
};
const logged = (signal: string, label: string, value: number, score: number): Drift => ({
  signal, label, value, bandLo: 0, bandHi: 0, howFar: score, howFast: 0, score, status: score >= 4 ? "far outside" : "outside band",
});
/** DEMO scores: a ticked symptom = 3; vision clarity 2 = 3, 1 = 4; workload 4 = 2.5, 5 = 3.5 */
function loggedDrift(today: Reading | undefined, inputs: LoggedInputs) {
  const out: Record<string, Drift> = {};
  for (const s of inputs.symptoms ?? [])
    if (SYMPTOM_LABEL[s]) out[`symptom_${s}`] = logged(`symptom_${s}`, SYMPTOM_LABEL[s], 1, 3);
  const v = inputs.vision_score;
  if (typeof v === "number" && v <= 2) out.vision_selfreport = logged("vision_selfreport", `Vision clarity ${v} of 5`, v, v <= 1 ? 4 : 3);
  const w = (today as Record<string, unknown> | undefined)?.workload_1to5;
  if (typeof w === "number" && w >= 4) out.workload_1to5 = logged("workload_1to5", `Workload ${w} of 5`, w, w >= 5 ? 3.5 : 2.5);
  return out;
}

export function evaluateRisks(
  history: Reading[],
  day: number,
  profile: MissionProfile = "mars_transit",
  inputs: LoggedInputs = {},
): RiskResult[] {
  const upTo = history
    .filter((r) => r.day <= day)
    .sort((a, b) => a.day - b.day);
  if (upTo.length === 0) return [];
  const today = upTo[upTo.length - 1];
  const bands = computeBaselines(upTo, day);
  const baselineDays = Object.values(bands)[0]?.nDays ?? 0;
  const todayRow = upTo.find((r) => r.day === day);
  const drift = { ...computeDrift(history, bands, day), ...loggedDrift(todayRow, inputs) };
  const provided = new Set<string>();
  if (Array.isArray(inputs.symptoms)) provided.add("symptoms");
  if (typeof inputs.vision_score === "number") provided.add("vision");
  if (typeof (todayRow as Record<string, unknown> | undefined)?.workload_1to5 === "number") provided.add("workload");
  return COUPLING_RULES.map((rule) =>
    evaluateRule(rule, { day, today, drift, profile, provided }, baselineDays),
  ).sort((a, b) => RANK[b.level] - RANK[a.level] || b.score - a.score);
}
