import type { Reading } from "../../src/engine/types.ts";
import type { z } from "zod";
import { randomUUID } from "node:crypto";
import type { Ask } from "./contracts.ts";
import type { assessCrew } from "../../src/engine/assessment.ts";
import { evidence } from "./evidence.ts";
import { retrieve } from "./retrieval.ts";
import {
  generateAnswer,
  ModelFailure,
  type ModelOptions,
} from "./assistant-model.ts";
import { triage, medicationAdvice } from "../../src/shared/triage.ts";
import { UNITS } from "./contracts.ts";
import { resolveModelConfig, ModelConfigurationError } from "./model-config.ts";
import { topicAnswer, topicText } from "../../src/shared/assistantTopics.ts";
import { isYou } from "../../src/data/you.ts";
import { asksAboutData } from "../../src/shared/dataQuestion.ts";
export { triage } from "../../src/shared/triage.ts";
export type AssistantInput = z.input<typeof Ask>;
export const ASSISTANT_VERSION = "halo-rag-1.0";

export function assistantStatus(options: ModelOptions = {}) {
  let configured = false;
  let status = "not_configured";
  let message = "Hosted AI is not configured.";
  let model: string | undefined;
  try {
    model = resolveModelConfig(options).model;
    configured = true;
    status = "configured_not_verified";
    message =
      "Server configured. A successful answer is needed to verify model access.";
  } catch (error) {
    if (error instanceof ModelConfigurationError) {
      status = error.status;
      message = error.message;
    }
  }
  return {
    configured,
    provider: options.provider ?? "openai",
    model: configured ? model : null,
    providerVerified: false,
    status,
    message,
    evidenceSources: evidence.length,
    evidenceReview: "domain_review_pending",
    requiresConsent: true,
    version: ASSISTANT_VERSION,
  };
}

// This screen catches selected high-risk output patterns, not all possible medical errors.
// Citation-ID checks verify traceability, not whether the source entails generated prose.
const UNSAFE_OUTPUT =
  /\b(?:take|swallow|inject|drink|administer)\s+(?:up to\s+)?\d+(?:\.\d+)?\s*(?:mg|mcg|ml|litres?|liters?|tablets?|pills?)\b|\b(?:start|stop|double|increase|decrease|skip|change)\b[^.!?\n]{0,35}\b(?:your |the )?(?:dose|medication|medicine|tablets?|pills?)\b|\byou (?:have|are diagnosed with|definitely have) (?:a |an )?(?:kidney stone|renal failure|infection|disease|syndrome)\b|\b(?:you are|you're) (?:cleared|fit|safe) (?:for|to)|\b(?:ignore|override) (?:the |your )?(?:doctor|medical officer|protocol)/i;

export async function answer(
  input: AssistantInput,
  assessment: ReturnType<typeof assessCrew>,
  options: ModelOptions = {},
  currentReading?: Reading,
) {
  const t = triage(input.question, input.symptoms);
  const medication = medicationAdvice(input.question);
  const previous = (input.history ?? [])
    .filter((m) => m.role === "user")
    .map((m) => m.content);
  const retrieved =
    t.urgent || medication ? [] : retrieve(input.question, previous);
  const relevant = retrieved;
  const priority = assessment.priority;
  // Curated answers for the most common questions come first: they carry a concrete next step
  const topic =
    t.urgent || medication
      ? null
      : topicAnswer(input.question, priority, {
          reading:
            currentReading?.crew_id === input.crewId &&
            currentReading.day === input.day
              ? (currentReading as unknown as Record<string, unknown>)
              : undefined,
          drift: assessment.drift,
        });
  let explanation = t.urgent
    ? "Contact the crew medical officer immediately and follow the onboard emergency procedure. Do not wait for an Earth reply."
    : medication
      ? "I cannot recommend a medication dose or start, stop, or change a medicine. Refer to the flight surgeon’s approved schedule. I can explain the research on medication storage and stability."
      : topic
        ? topicText(topic)
        : relevant.length
          ? `Reference summary (not an AI-generated answer): ${[
              ...relevant.filter((p) => p.kind === "summary"),
              ...relevant.filter((p) => p.kind !== "summary"),
            ]
              .slice(0, 2)
              .map((p) =>
                p.kind === "summary"
                  ? p.text
                  : `From "${p.title}": "${p.text.length > 320 ? p.text.slice(0, 320).replace(/\s+\S*$/, "") + "…" : p.text}"`,
              )
              .join(" ")} ${relevant[0].limitations[0]}`
          : "The current evidence library does not cover this question. Ask the crew medical officer or add a reviewed source; I cannot infer an answer from unrelated readings.";
  const asksData = asksAboutData(input.question);
  if (!t.urgent && !medication && !topic && asksData) {
    explanation = priority
      ? `Current demonstration assessment: ${priority.name}, ${priority.level}. ${priority.why}. ${priority.action} Missing inputs: ${assessment.unknown.join(", ") || "none listed"}.`
      : `No active coupled pattern is established. Unassessed hypotheses: ${assessment.unknown.join(", ") || "none listed"}. This is not an all-clear.`;
  }
  const fallbackIds = t.urgent
    ? ["nasa_body"]
    : medication
      ? ["drug_2011"]
      : topic
        ? topic.evidenceIds
        : asksData
          ? (priority?.evidenceIds ?? [])
          : relevant.slice(0, 2).map((p) => p.sourceId);
  let citations = evidence.filter((e: any) => fallbackIds.includes(e.id));
  let mode = "offline_rules";
  let modelStatus = "not_requested";
  let providerDataSent = false;
  let failureReason: string | null = null;
  let paragraphs: {
    text: string;
    evidenceIds: string[];
    signalKeys: string[];
  }[] = [];
  let uncertainties = [
    "Rules and source summaries have not been clinically validated or approved.",
  ];
  let followUp = ["What changed, and when did you notice it?"];
  let insufficientEvidence = !relevant.length && !asksData && !topic;
  const rawMeasurements =
    currentReading?.crew_id === input.crewId && currentReading.day === input.day
      ? Object.entries(UNITS)
          .filter(
            ([key]) =>
              typeof currentReading[key as keyof Reading] === "number" &&
              Number.isFinite(currentReading[key as keyof Reading]),
          )
          .map(([key, unit]) => ({
            key,
            unit,
            value: currentReading[key as keyof Reading],
            missionDay: input.day,
          }))
      : [];
  const signals = Object.entries(assessment.drift).map(([key, d]) => ({
    key,
    value: d.value,
    unit: UNITS[key] ?? "demo index",
    reference: [d.bandLo, d.bandHi],
    status: d.status,
    valueBasis: "engine current value; slow signals may be recent averages",
  }));
  // Nothing measured for this person (the empty "You" profile): there is nothing to ground an answer in, so say so
  if (
    !rawMeasurements.length &&
    !signals.length &&
    asksData &&
    !t.urgent &&
    !medication &&
    !topic
  ) {
    explanation =
      "HALO has no readings for you yet, so it cannot say how you are doing. Import your Apple Health export in Settings, connect a strap, or do today's check-in in Daily Log. HALO only judges what it has measured.";
    insufficientEvidence = true;
  }
  if (t.urgent || medication) modelStatus = "safety_bypass";
  else if (input.allowAI) {
    const configuration = assistantStatus(options);
    if (!configuration.configured) modelStatus = configuration.status;
    else if (insufficientEvidence) modelStatus = "insufficient_evidence";
    else {
      try {
        providerDataSent = true;
        const generated = await generateAnswer(
          {
            question: input.question,
            conversation: input.history ?? [],
            selectedCrewContext: {
              missionDay: assessment.day,
              profile: assessment.profile,
              provenance: isYou(input.crewId)
                ? "own measurements, imports and check-ins (not simulated)"
                : "simulated",
              baselineKind: assessment.baselineKind,
              baselineDays: assessment.baselineDays,
              rawMeasurements,
              signals,
              risks: assessment.risks.map((r) => ({
                ruleId: r.ruleId,
                name: r.name,
                level: r.level,
                why: r.why,
                missing: r.missing,
                uncertainty: r.uncertainty,
              })),
            },
            evidence: relevant,
          },
          options,
        );
        const ids = new Set(relevant.map((p) => p.id));
        const keys = new Set([
          ...signals.map((s) => s.key),
          ...rawMeasurements.map((s) => s.key),
        ]);
        const prose = [
          ...generated.paragraphs.map((p) => p.text),
          ...generated.uncertainties,
          ...generated.followUp,
        ].join(" ");
        if (
          UNSAFE_OUTPUT.test(prose) ||
          /https?:\/\//i.test(prose) ||
          generated.paragraphs.some(
            (p) =>
              p.evidenceIds.some((id) => !ids.has(id)) ||
              p.signalKeys.some((k) => !keys.has(k)) ||
              (!generated.insufficientEvidence &&
                !p.evidenceIds.length &&
                !p.signalKeys.length),
          )
        )
          throw new ModelFailure("invalid_output");
        paragraphs = generated.paragraphs;
        explanation = paragraphs.map((p) => p.text).join("\n\n");
        const citedSources = new Set(
          relevant
            .filter((p) => paragraphs.some((x) => x.evidenceIds.includes(p.id)))
            .map((p) => p.sourceId),
        );
        citations = evidence.filter((e: any) => citedSources.has(e.id));
        uncertainties = generated.uncertainties;
        followUp = generated.followUp;
        insufficientEvidence = generated.insufficientEvidence;
        mode = "grounded_ai";
        modelStatus = "available";
      } catch (error) {
        failureReason =
          error instanceof ModelFailure ? error.reason : "invalid_output";
        modelStatus = "failed_using_offline_fallback";
      }
    }
  }
  return {
    answerId: randomUUID(),
    version: ASSISTANT_VERSION,
    mode,
    modelStatus,
    failureReason,
    providerDataSent,
    triage: t,
    explanation,
    paragraphs,
    citations,
    retrieval: { method: "bm25_curated_summaries", passages: relevant },
    signalReferences: signals,
    followUp,
    uncertainties,
    insufficientEvidence,
    escalation: t.urgent
      ? "Immediate crew medical review"
      : "Crew medical review for symptoms or operational decisions",
    limitations:
      "Research prototype. Generated answers can be wrong; citation checks do not prove clinical correctness. Sources await domain review. No diagnosis, dosing or flight clearance.",
    transmitted: false,
  };
}
