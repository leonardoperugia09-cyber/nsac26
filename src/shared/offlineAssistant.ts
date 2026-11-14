import { triage, MEDICATION_TEXT } from "./triage.ts";
import { topicAnswer, topicText } from "./assistantTopics.ts";
import type { assessCrew } from "../engine/assessment.ts";
export function answer(question: string, a: ReturnType<typeof assessCrew>) {
  const urgent = triage(question).urgent;
  const medication = MEDICATION_TEXT.test(question);
  const topic = urgent || medication ? null : topicAnswer(question, a.priority);
  return {
    mode: "offline_rules",
    triage: { urgent },
    explanation: urgent
      ? "Contact the crew medical officer immediately and follow the onboard emergency protocol. Do not wait for an Earth reply."
      : medication
        ? "I cannot recommend doses or change medication. Refer to your approved schedule and medical officer."
        : topic
          ? topicText(topic)
          : a.priority
            ? `${a.priority.name}: ${a.priority.level}. ${a.priority.why}. ${a.priority.action}`
            : "No persistent demo pattern established. Missing inputs and symptoms still require human review.",
    escalation: "Use the approved crew medical escalation process.",
    citations: [],
    limitations:
      "Offline deterministic fallback. No model call, no diagnosis, no transmission. Bundled rule references are not clinical approval.",
  };
}
