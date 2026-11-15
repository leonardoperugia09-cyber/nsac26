import { z } from "zod";
import { BASELINE_FIELDS, DAYS, EVENT_INFO } from "../../src/sim/simulator.ts";
export const Profile = z.enum(["iss", "moon", "mars_transit"]);
export const Selection = z.object({
  crewId: z.string().regex(/^(C[123]|U1)$/), // U1 = the "You" profile (real data only)
  day: z.coerce.number().int().min(1).max(120),
  profile: Profile.default("mars_transit"),
});
export type SelectionType = z.infer<typeof Selection>;
export { UNITS } from "../../src/shared/units.ts";
import { UNITS } from "../../src/shared/units.ts";
const num = z.number().finite();
export const Values = z
  .object(
    Object.fromEntries(
      Object.keys(UNITS).map((k) => [k, num.nullable().optional()]),
    ),
  )
  .strict();
export const Symptoms = z
  .array(
    z.enum([
      "chest_pain",
      "breathing_difficulty",
      "sudden_vision_loss",
      "confusion",
      "severe_pain",
      "headache",
      "blurred_vision",
      "puffy_face",
      "cold_sore",
      "skin_symptoms",
    ]),
  )
  .max(10);
export const Checkin = z
  .object({
    crewId: Selection.shape.crewId,
    day: Selection.shape.day,
    measurements: Values,
    symptoms: Symptoms.optional(),
    vision_score: num.int().min(1).max(5).optional(),
    workload: num.min(0).max(10).optional(),
  })
  .strict()
  .superRefine((v, ctx) => {
    for (const [k, n] of Object.entries(v.measurements)) {
      if (n == null) continue;
      if (
        ["mood_1to5", "stress_1to5"].includes(k) &&
        (!Number.isInteger(n) || n < 1 || n > 5)
      )
        ctx.addIssue({
          code: "custom",
          path: ["measurements", k],
          message: "Ordinal scale is 1–5",
        });
      if (k === "urine_color_1to8" && (!Number.isInteger(n) || n < 1 || n > 8))
        ctx.addIssue({
          code: "custom",
          path: ["measurements", k],
          message: "Ordinal scale is 1–8",
        });
      if (k === "sleep_hours" && (n < 0 || n > 24))
        ctx.addIssue({
          code: "custom",
          path: ["measurements", k],
          message: "Hours must be 0–24",
        });
      if (k === "spo2" && (n < 0 || n > 100))
        ctx.addIssue({
          code: "custom",
          path: ["measurements", k],
          message: "Percent must be 0–100",
        });
    }
  });
export const Ask = Selection.extend({
  question: z.string().trim().min(1).max(2000),
  symptoms: Symptoms.default([]),
  allowAI: z.boolean().default(false),
  // One current heart-rate value from an attached strap, read in the browser
  live: z
    .object({
      name: z.string().trim().min(1).max(80),
      simulated: z.boolean(),
      bpm: z.number().min(20).max(250),
      secondsAgo: z.number().int().min(0).max(3600),
    })
    .strict()
    .optional(),
  history: z
    .array(
      z
        .object({
          role: z.enum(["user", "assistant"]),
          content: z.string().trim().min(1).max(2000),
        })
        .strict(),
    )
    .max(6)
    .default([]),
}).strict();
export const ReportDraft = Selection.extend({
  purpose: z
    .enum(["routine", "risk_review", "urgent_review"])
    .default("risk_review"),
}).strict();
export const QueueReport = z
  .object({
    reportId: z.uuid(),
    approved: z.literal(true),
    delaySeconds: z.number().int().min(0).max(1800),
    windowOpensAt: z.iso.datetime().optional(),
    idempotencyKey: z.string().min(8).max(100),
  })
  .strict();
export const Medication = z
  .object({
    id: z.string().regex(/^[a-zA-Z0-9_-]{1,60}$/),
    crewId: Selection.shape.crewId,
    name: z.string().min(1).max(120),
    scheduleReference: z.string().min(1).max(160),
    scheduledTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
    expiresAt: z.iso.datetime(),
    storageComplete: z.boolean(),
    provenance: z.literal("demo_schedule"),
  })
  .strict();
export const Adherence = z
  .object({
    crewId: Selection.shape.crewId,
    medicationId: Medication.shape.id,
    day: Selection.shape.day,
    status: z.enum(["taken", "missed", "not_recorded"]),
  })
  .strict();
export const TestResult = z
  .object({
    crewId: Selection.shape.crewId,
    day: Selection.shape.day,
    type: z.enum(["reaction", "memory", "vision"]),
    values: z.array(num).min(1).max(300),
    protocolVersion: z.literal("halo-demo-1"),
  })
  .strict();
export const WhatIf = Selection.extend({
  horizon: z.number().int().min(1).max(30),
  changes: Values,
}).strict();
/** One instrument reading (strap, file import, manual), shared by review and storage */
export const Measurement = z
  .object({
    signal: z.enum(Object.keys(UNITS) as [string, ...string[]]),
    value: num.nullable(),
    unit: z.string(),
    sourceId: z.string().min(1).max(120),
    provenance: z.enum(["measured", "self_reported", "estimated", "simulated"]),
    observedAt: z.iso.datetime().optional(),
    missionDay: z.number().int().positive().optional(),
    quality: z.enum(["valid", "suspect", "invalid"]).default("valid"),
  })
  .strict();
export const MeasurementReview = z
  .object({
    maxAgeSeconds: z.number().int().positive().optional(),
    measurements: z.array(Measurement).max(26),
  })
  .strict();
/** A batch of readings for one astronaut, as sent by the app's instruments */
export const MeasurementBatch = z
  .object({
    crewId: Selection.shape.crewId,
    measurements: z.array(Measurement).max(500),
  })
  .strict();

export const MedicationDay = z
  .object({
    crewId: Selection.shape.crewId,
    day: Selection.shape.day,
    state: z
      .object({
        taken: z.record(z.string().max(100), z.string().max(20)),
        skipped: z.record(z.string().max(100), z.string().max(200)),
        extra: z
          .array(
            z.object({ medId: z.string().max(100), time: z.string().max(20) }),
          )
          .max(100),
        notes: z
          .array(
            z.object({ text: z.string().max(2000), time: z.string().max(20) }),
          )
          .max(100),
      })
      .strict(),
  })
  .strict();

// A scenario edited in Settings: the server re-runs the same simulator, so only crew and events travel
export const ScenarioInput = z
  .object({
    crew: z
      .array(
        z
          .object({
            id: z.string().regex(/^C[1-3]$/),
            name: z.string().trim().min(3).max(80),
            role: z.string().trim().min(2).max(80),
            age: z.number().int().min(21).max(70),
            sex: z.enum(["F", "M"]),
            baseline: z
              .object(
                Object.fromEntries(
                  BASELINE_FIELDS.map((f) => [
                    f.key,
                    z.number().min(f.min).max(f.max),
                  ]),
                ),
              )
              .strict(),
          })
          .strict(),
      )
      .length(3),
    events: z
      .array(
        z
          .object({
            id: z.string().min(1).max(60),
            type: z.enum(["solar_storm", "fluid_drop", "short_night"]),
            crewId: z.string().regex(/^(C[1-3]|all)$/),
            day: z.number().int().min(1).max(DAYS),
            length: z.number().int().min(1).max(DAYS).optional(),
            strength: z.number(),
          })
          .strict()
          .refine(
            (e) =>
              e.strength >= EVENT_INFO[e.type].min &&
              e.strength <= EVENT_INFO[e.type].max,
            "Event strength out of range",
          )
          .refine(
            (e) => e.type === "solar_storm" || e.crewId !== "all",
            "This event needs one astronaut",
          ),
      )
      .max(20),
    today: z.number().int().min(1).max(DAYS).optional(),
  })
  .strict();
