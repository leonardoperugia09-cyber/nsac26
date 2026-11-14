import type { z } from "zod";
import type { Ask } from "./contracts.ts";
import type { assessCrew } from "../../src/engine/assessment.ts";
import { evidence } from "./evidence.ts";
import { triage, MEDICATION_TEXT as MED } from "../../src/shared/triage.ts";
import { topicAnswer, topicText } from "../../src/shared/assistantTopics.ts";
export { triage } from "../../src/shared/triage.ts";
export type AssistantInput = z.infer<typeof Ask>;
export async function answer(
  input: AssistantInput,
  assessment: ReturnType<typeof assessCrew>,
  options: { apiKey?: string; model?: string } = {},
) {
  const t = triage(input.question, input.symptoms);
  const priority = assessment.priority;
  const topic =
    t.urgent || MED.test(input.question)
      ? null
      : topicAnswer(input.question, priority);
  let text = t.urgent
    ? "Contact the crew medical officer immediately and follow the onboard emergency procedure. Do not wait for an Earth reply."
    : MED.test(input.question)
      ? "I cannot recommend a medication dose or start, stop, or change a medicine. Refer to the flight surgeon’s approved schedule."
      : topic
        ? topicText(topic)
        : priority
          ? `${priority.name}: ${priority.level}. ${priority.contributors.map((c) => c.label).join(", ")} contribute to this demonstration pattern. ${priority.action}`
          : "The available data do not establish an active multi-signal pattern. Missing data and symptoms still require human review; this is not an all-clear.";
  const ids = MED.test(input.question)
    ? ["drug_2011"]
    : (topic?.evidenceIds ?? priority?.evidenceIds ?? ["nasa_body"]);
  const citations = evidence.filter((e: any) => ids.includes(e.id));
  let mode = "offline_rules";
  let modelStatus = "not_requested";
  // Constrain the model to approved sentence IDs; never expose unreviewed model treatment prose.
  const sentences = [
    text,
    "The cited mechanisms do not validate a personal risk probability.",
    "This prototype needs human review before decisions.",
  ];
  if (input.allowAI && !t.urgent && !MED.test(input.question)) {
    if (!options.apiKey || !options.model) modelStatus = "not_configured";
    else
      try {
        const response = await fetch(
          "https://api.openai.com/v1/chat/completions",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${options.apiKey}`,
              "Content-Type": "application/json",
            },
            signal: AbortSignal.timeout(12000),
            body: JSON.stringify({
              model: options.model,
              messages: [
                {
                  role: "system",
                  content:
                    'Select a helpful order for the supplied reviewed explanation sentences. Return JSON {"order":[0,1,2]}. Never invent text.',
                },
                {
                  role: "user",
                  content: JSON.stringify({ sentences, evidenceIds: ids }),
                },
              ],
              response_format: { type: "json_object" },
              max_completion_tokens: 150,
            }),
          },
        );
        if (!response.ok) throw Error("model unavailable");
        const body: any = await response.json();
        const parsed = JSON.parse(body.choices[0].message.content);
        if (
          !Array.isArray(parsed.order) ||
          parsed.order.length !== 3 ||
          new Set(parsed.order).size !== 3 ||
          parsed.order.some((n: any) => !Number.isInteger(n) || n < 0 || n > 2)
        )
          throw Error("invalid output");
        text = parsed.order.map((i: number) => sentences[i]).join(" ");
        mode = "ai_selected_reviewed_explanation";
        modelStatus = "available";
      } catch {
        modelStatus = "failed_using_offline_fallback";
      }
  }
  return {
    mode,
    modelStatus,
    triage: t,
    explanation: text,
    citations,
    signalReferences: priority?.contributors ?? [],
    followUp: [
      "When did this start?",
      "Are there new symptoms or unreliable measurements?",
      "Can the crew medical officer review the approved protocol?",
    ],
    escalation: t.urgent
      ? "Immediate crew medical review"
      : "Crew medical review according to mission procedures",
    limitations:
      "No diagnosis or dosing; hosted AI is constrained to reviewed wording. Source summaries await domain review.",
    transmitted: false,
  };
}
