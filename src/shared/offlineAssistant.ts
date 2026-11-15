import { triage, medicationAdvice } from "./triage.ts";
import { asksAboutData } from "./dataQuestion.ts";
import { searchEvidence, sourceOf } from "./evidenceSearch.ts";
import { topicAnswer, topicText } from "./assistantTopics.ts";
import type { assessCrew } from "../engine/assessment.ts";
import type { AssistantReply } from "./assistantTypes.ts";
export function answer(
  question: string,
  a: ReturnType<typeof assessCrew>,
  symptoms: string[] = [],
  reading?: Record<string, unknown>,
): AssistantReply {
  const screen = triage(question, symptoms);
  const medication = medicationAdvice(question);
  // Same curated answers as the server, so the next step reads the same with or without the backend
  const topic =
    screen.urgent || medication
      ? null
      : topicAnswer(question, a.priority, { drift: a.drift, reading });
  const dataQuestion = asksAboutData(question);
  // With no server there is no AI, but the bundled source summaries can still answer, with their sources named
  const hits =
    screen.urgent || medication || topic || dataQuestion
      ? []
      : searchEvidence(question).slice(0, 2);
  const cited = [...new Set(hits.map((h) => h.sourceId))].flatMap((id) => {
    const s = sourceOf(id);
    return s
      ? [
          {
            id: s.id,
            title: s.title,
            source_url: s.source_url,
            review_status: s.review_status,
          },
        ]
      : [];
  });
  return {
    mode: "offline_rules",
    modelStatus: "backend_unavailable",
    providerDataSent: false,
    triage: screen,
    explanation: screen.urgent
      ? "Contact the crew medical officer immediately and follow the onboard emergency protocol. Do not wait for an Earth reply."
      : medication
        ? "I cannot recommend doses or change medication. Refer to your approved schedule and medical officer."
        : topic
          ? topicText(topic)
          : dataQuestion
            ? a.priority
              ? `Offline demonstration readout: ${a.priority.name}: ${a.priority.level}. ${a.priority.why}. ${a.priority.action}`
              : "No persistent demo pattern established. Missing inputs and symptoms still require human review."
            : hits.length
              ? `Reference summary (not an AI-generated answer): ${hits.map((h) => h.text).join(" ")} ${sourceOf(hits[0].sourceId)?.limitations[0] ?? ""}`.trim()
              : "The sources bundled in this app do not cover this question. Ask the crew medical officer; I cannot infer an answer from unrelated readings.",
    escalation: screen.urgent
      ? "Immediate crew medical review"
      : "Use the approved crew medical escalation process when needed.",
    citations: cited,
    retrieval: {
      passages: hits.map((h) => ({
        id: h.id,
        sourceId: h.sourceId,
        text: h.text,
      })),
    },
    followUp: [],
    limitations: hits.length
      ? "Source summaries from HALO's library, not a generated answer and not clinically reviewed. No model call or flight-surgeon transmission occurred."
      : "Offline fallback, not a generated answer. No model call or flight-surgeon transmission occurred.",
  };
}
