import type { Reading, MissionProfile } from "./types.ts";
import { SIGNAL_BY_KEY } from "./signals.ts";
import { computeBaselines, computeDrift, bandCentreAt } from "./baseline.ts";
import { evaluateRisks, isInputKey } from "./risks.ts";
import { COUPLING_RULES } from "../rules/index.ts";
import type { RiskResult } from "../rules/types.ts";
import { isYou } from "../data/you.ts";

export type Severity = "Nominal" | "Watch" | "Act" | "Unknown";
export const RULE_VERSION = "halo-demo-2.0";
export const EVIDENCE_IDS: Record<string, string[]> = {
  kidney_stone: ["nasa_body", "kidney_2024"],
  fluid_shift: ["nasa_body"],
  cognitive_readiness: ["nasa_body", "sleep_2014"],
  musculoskeletal: ["nasa_body", "muscle_2009"],
  immune_strain: ["nasa_body", "immune_2019"],
  under_fuelling: ["nasa_body"],
  solar_storm: ["nasa_body", "radlab_api"],
};
export type AssessedRisk = Omit<RiskResult, "level" | "score" | "range"> & {
  level: Severity;
  score: number | null;
  range: null;
  evidenceIds: string[];
  ruleVersion: string;
  missing: string[];
  persistence: { required: number; observed: number };
};
export const safeNumber = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);
export function assessCrew(
  history: Reading[],
  day: number,
  profile: MissionProfile = "mars_transit",
  context: Record<string, any> = {},
) {
  if (!Number.isInteger(day) || day < 1) throw new Error("Invalid mission day");
  const h = history.filter((r) => r.day <= day).sort((a, b) => a.day - b.day);
  const bands = computeBaselines(h, day);
  const drift = computeDrift(h, bands, day);
  const today = h.find((r) => r.day === day);
  const sourceProfile: MissionProfile = context.sourceProfile ?? "mars_transit";
  const raw = evaluateRisks(h, day, sourceProfile, {
    symptoms: Array.isArray(context.symptoms) ? context.symptoms : undefined,
    vision_score: safeNumber(context.vision_score)
      ? context.vision_score
      : undefined,
  });
  const rows = raw.map((r) => [r.ruleId, r] as const);
  const result = new Map(rows);
  const risks: AssessedRisk[] = COUPLING_RULES.map((rule) => {
    const r = result.get(rule.id);
    const missing = Object.keys(rule.signals).filter(
      (key) =>
        !isInputKey(key) &&
        (!today || !safeNumber((today as any)[key]) || !drift[key]),
    );
    // Vision and immune hypotheses require the extra symptoms absent from the simulator.
    if (rule.id === "fluid_shift") {
      const noSymptoms = !Array.isArray(context.symptoms);
      const noVision = !safeNumber(context.vision_score);
      if (noSymptoms && noVision)
        missing.push("symptom check and vision self-report");
      else if (noSymptoms) missing.push("symptom check");
      else if (noVision) missing.push("vision self-report");
    }
    if (rule.id === "immune_strain" && !Array.isArray(context.symptoms))
      missing.push("skin symptoms and cold sore check");
    const acuteCognition =
      rule.id === "cognitive_readiness" &&
      today?.eva_scheduled &&
      ["sleep_hours", "reaction_time_ms", "memory_score"].filter(
        (k) => (drift[k]?.score ?? 0) >= 3,
      ).length >= 2;
    const required = rule.id === "solar_storm" || acuteCognition ? 1 : 2;
    let observed = 0;
    for (let d = day; d >= Math.max(1, day - required + 1); d--) {
      const previous = h.find((x) => x.day === d);
      if (
        !previous ||
        Object.keys(rule.signals).some(
          (k) => !isInputKey(k) && !safeNumber((previous as any)[k]),
        )
      )
        break;
      const earlier = evaluateRisks(
        h.filter((x) => x.day <= d),
        d,
        sourceProfile,
      ).find((x) => x.ruleId === rule.id);
      if (!earlier || earlier.level === "Nominal") break;
      if (rule.id !== "solar_storm") {
        const ref = computeBaselines(
          h.filter((x) => x.day <= d),
          d,
        );
        const active = Object.keys(rule.signals).filter((k) => {
          const b = ref[k],
            def = SIGNAL_BY_KEY[k],
            v = (previous as any)[k];
          if (!b || !def || !safeNumber(v)) return false;
          const z = (v - bandCentreAt(b, d)) / b.sd;
          return (
            (def.badDirection === 0 ? Math.abs(z) : def.badDirection * z) >= 1.5
          );
        }).length;
        if (active < rule.minLinked) break;
      }
      observed++;
    }
    // Symptoms the astronaut reports today are direct evidence: when they push a rule to Watch or Act, that
    // level stands even if some readings are missing or there is no second day yet (missing stays listed)
    const symptomDriven =
      !!r &&
      (r.level === "Watch" || r.level === "Act") &&
      r.contributors.some((c) => isInputKey(c.signal) && c.score >= 1.5);
    const level: Severity = symptomDriven
      ? r!.level
      : missing.length || !r
        ? "Unknown"
        : observed < required
          ? "Nominal"
          : r.level;
    const caution =
      "Demonstration pattern only; not a validated probability, diagnosis, or flight clearance.";
    return {
      ruleId: rule.id,
      name: rule.name,
      level,
      score: missing.length && !symptomDriven ? null : (r?.score ?? null),
      range: null,
      contributors: (r?.contributors ?? []).map((c) => ({ ...c })),
      linked: r?.linked ?? 0,
      why: rule.why,
      action:
        level === "Unknown"
          ? "Obtain missing inputs and request human review."
          : level === "Nominal"
            ? "Continue scheduled observations; report symptoms independently."
            : "Review contributing readings with the crew medical officer and the approved mission protocol.",
      source: rule.source,
      uncertainty: [
        caution,
        ...(r?.uncertainty ?? []),
        ...(missing.length ? [`Unavailable: ${missing.join(", ")}`] : []),
      ],
      bodyParts: rule.bodyParts,
      evidenceIds: EVIDENCE_IDS[rule.id],
      ruleVersion: RULE_VERSION,
      missing,
      persistence: { required, observed },
    };
  });
  const rank: Record<Severity, number> = {
    Act: 3,
    Watch: 2,
    Unknown: 1,
    Nominal: 0,
  };
  risks.sort(
    (a, b) => rank[b.level] - rank[a.level] || (b.score ?? 0) - (a.score ?? 0),
  );
  const priority =
    risks.find((r) => r.level === "Act" || r.level === "Watch") ?? null;
  return {
    day,
    profile,
    radiationReferenceProfile: sourceProfile,
    baselineKind: isYou(h[0]?.crew_id ?? "")
      ? "own_measurements_days_7_20"
      : "simulated_inflight_adaptation_days_7_20",
    baselineDays: Object.values(bands)[0]?.nDays ?? 0,
    bands,
    drift,
    risks,
    priority,
    provenance: "simulated",
    ruleVersion: RULE_VERSION,
    unknown: risks.filter((r) => r.level === "Unknown").map((r) => r.ruleId),
  };
}
export function readiness(
  history: Reading[],
  day: number,
  profile: MissionProfile = "mars_transit",
  context: Record<string, any> = {},
) {
  const a = assessCrew(history, day, profile, context);
  const keys = ["sleep_hours", "reaction_time_ms", "radiation_mSv_today"];
  const missing = keys.filter((k) => !a.drift[k]);
  const storm = a.risks.find((r) => r.ruleId === "solar_storm");
  const bad = keys.filter((k) => a.drift[k]?.score >= 2);
  const status = missing.length
    ? "Insufficient data"
    : a.risks.some((r) => r.level === "Act") ||
        bad.some((k) => a.drift[k].score >= 3)
      ? "No-go"
      : bad.length ||
          a.risks.some((r) => r.level === "Watch") ||
          a.unknown.length
        ? "Caution"
        : "Go";
  return {
    status,
    missing,
    inputs: keys.map((key) => ({ key, reading: a.drift[key] ?? null })),
    reasons: missing.length
      ? ["Fresh inputs and sufficient baseline are required."]
      : bad.length
        ? bad.map((k) => `${k} exceeded the demonstration drift threshold.`)
        : a.risks.some((r) => r.level === "Act")
          ? ["An active Act pattern requires review before the task."]
          : a.unknown.length
            ? ["Unassessed hypotheses require human review before the task."]
            : a.risks.some((r) => r.level === "Watch")
              ? ["A Watch pattern requires human review before the task."]
              : ["No configured demo threshold was crossed."],
    ruleVersion: RULE_VERSION,
    thresholds: { cautionDrift: 2, noGoDrift: 3 },
    advisoryOnly: true,
    requiresHumanApproval: true,
    limitation: "Go does not constitute operational or medical clearance.",
  };
}
