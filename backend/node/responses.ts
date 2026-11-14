import { z } from "zod";
const object = (shape: z.ZodRawShape) => z.object(shape).catchall(z.unknown());
export const RiskOutput = object({
  ruleId: z.string(),
  name: z.string(),
  level: z.enum(["Nominal", "Watch", "Act", "Unknown"]),
  score: z.number().finite().nullable(),
  range: z.null(),
  contributors: z.array(
    object({
      signal: z.string(),
      label: z.string(),
      score: z.number().finite(),
    }),
  ),
  ruleVersion: z.string(),
  missing: z.array(z.string()),
  evidenceIds: z.array(z.string()),
  action: z.string(),
  uncertainty: z.array(z.string()),
  persistence: z.object({
    required: z.number().int(),
    observed: z.number().int(),
  }),
});
export const AssessmentOutput = object({
  day: z.number().int(),
  profile: z.string(),
  baselineKind: z.string(),
  baselineDays: z.number().int(),
  risks: z.array(RiskOutput),
  priority: RiskOutput.nullable(),
  provenance: z.literal("simulated"),
  unknown: z.array(z.string()),
});
export const ReadinessOutput = object({
  status: z.enum(["Go", "Caution", "No-go", "Insufficient data"]),
  missing: z.array(z.string()),
  reasons: z.array(z.string()),
  advisoryOnly: z.literal(true),
  requiresHumanApproval: z.literal(true),
  limitation: z.string(),
});
export const SnapshotOutput = object({
  selection: object({
    crewId: z.string(),
    day: z.number().int(),
    profile: z.string(),
  }),
  crew: object({ id: z.string(), name: z.string() }),
  reading: object({ crew_id: z.string(), day: z.number().int() }),
  assessment: AssessmentOutput,
  readiness: ReadinessOutput,
  provenance: object({
    kind: z.literal("simulated"),
    datasetSha256: z.string(),
    source: z.string(),
    timeBasis: z.literal("mission_day"),
  }),
});
export const EvidenceOutput = object({
  id: z.string(),
  title: z.string(),
  source_url: z.url(),
  studied_population: z.string(),
  supported_claims: z.array(z.string()),
  limitations: z.array(z.string()),
  review_status: z.string(),
  clinically_approved: z.literal(false),
});
export const AssistantOutput = object({
  mode: z.enum(["offline_rules", "ai_selected_reviewed_explanation"]),
  modelStatus: z.string(),
  triage: object({
    urgent: z.boolean(),
    flags: z.array(z.string()),
    uncertainty: z.string(),
  }),
  explanation: z.string(),
  citations: z.array(EvidenceOutput),
  followUp: z.array(z.string()),
  escalation: z.string(),
  transmitted: z.literal(false),
  limitations: z.string(),
});
export const responseContracts: Record<string, z.ZodType> = {
  "/api/snapshot": SnapshotOutput,
  "/api/risks": AssessmentOutput,
  "/api/readiness": ReadinessOutput,
  "/api/assistant": AssistantOutput,
  "/api/evidence": z.array(EvidenceOutput),
  "/api/checkins": z.unknown(),
  "/api/measurements": z.unknown(),
  "/api/fhir/Observation": z.unknown(),
};
