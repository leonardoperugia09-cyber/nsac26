import { triage, medicationAdvice } from "./triage.ts";
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
  const dataQuestion =
    /reading|measurement|risk|pattern|baseline|my data|changed|قياس|قراءات|بيانات|مخاطر/iu.test(
      question,
    );
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
            : "The AI backend is unavailable, so I cannot generate an answer to this question. You can still review the bundled evidence and on-device assessment.",
    escalation: screen.urgent
      ? "Immediate crew medical review"
      : "Use the approved crew medical escalation process when needed.",
    citations: [],
    followUp: [],
    limitations:
      "Offline fallback, not a generated answer. No model call or flight-surgeon transmission occurred.",
  };
}
