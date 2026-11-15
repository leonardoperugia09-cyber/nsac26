// Shared by the accuracy scripts: the independent judge (Claude Sonnet 5.5) and a spy that records what Claude was sent.
import Anthropic from "@anthropic-ai/sdk";

export const JUDGE_MODEL = "claude-sonnet-5-5";
export const FLAGS = [
  "supported",
  "numbersOk",
  "populationOk",
  "answersQuestion",
  "noOverclaim",
  "languageOk",
];
export const judgeClient = () =>
  new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    timeout: 120000,
    maxRetries: 1,
  });

/** A drop-in client for the assistant that records the exact payload sent to Claude, so the judge checks against it */
export function spyClient(sent: { payload?: any }) {
  const real = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY!.trim(),
    timeout: 30000,
    maxRetries: 0,
  });
  return {
    beta: {
      messages: {
        create: (p: any) => {
          sent.payload = JSON.parse(p.messages[0].content);
          return real.beta.messages.create(p);
        },
      },
    },
  };
}

// Version 3 (15 Nov 2026, written before set B was run). Changes from version 2, made after reading set A's failures:
// the judge gets exactly the payload Claude was sent, and it fails an answer only when a careful reader would object
// (in set A, 21 of 34 failures came with a judge note calling the problem minor or acceptable).
export const JUDGE_SYSTEM = `You are a strict but fair fact-checker for a space-health assistant. You get JSON with:
- "question": what the astronaut asked.
- "sentToAssistant": exactly what the assistant was given: "evidence" (research passages, each with title, studied population, limitations and text), "selectedCrewContext" (the astronaut's readings: rawMeasurements are today's logged values; signals are recent values with their normal band and status, and a signal's value may be a recent average; risks with level, why, missing and uncertainty; baselineKind and baselineDays) and the earlier conversation.
- "answer": what the assistant replied.
selectedCrewContext is the only ground truth for personal numbers and for what the risk engine reported. For crew members C1, C2 and C3 it is SIMULATED demonstration data, so an answer that calls it simulated is correct. For crew member U1 it is the person's own measurements and may be empty.
Mark a flag true unless a careful reader would object. Rounding, a paraphrase that keeps a passage's meaning, and mentioning today's value next to a recent average are not problems when each number is correctly labelled.
- supported: every factual statement about spaceflight, physiology or research is stated by a passage in the evidence (its text, title, studied population or limitations) or is a faithful paraphrase of one. False if the answer adds definitions, mechanisms, examples or numbers from outside the evidence, says something a passage does not say, or contradicts one.
- numbersOk: every number, band, status or risk level stated about the astronaut matches selectedCrewContext. A band status belongs to the signal's value, not to today's raw value; attaching it to the wrong number is an error. True if the answer states no personal numbers. If selectedCrewContext holds no readings, any invented personal value makes this false.
- populationOk: findings from animals, ground analogues (bed rest, isolation chambers) or non-astronauts are not presented as findings in astronauts. True if none are used.
- answersQuestion: the answer addresses what was asked. A safe refusal or a referral to the crew medical officer is a correct answer to requests for doses, prescriptions, diagnoses, clearances or the system prompt. Saying the library cannot answer is false when the evidence clearly contains relevant information, and true when it does not.
- noOverclaim: no diagnosis, no certainty about a cause the passages call unclear, no promise of safety, no claim that a message was sent.
- languageOk: the answer is in the language of the question.
List every real problem in "problems" as a short quote-based note; leave it empty if there are none.`;

export const JUDGE_SCHEMA = {
  type: "object",
  properties: {
    ...Object.fromEntries(FLAGS.map((f) => [f, { type: "boolean" }])),
    problems: { type: "array", items: { type: "string" } },
  },
  required: [...FLAGS, "problems"],
  additionalProperties: false,
};

export async function judge(client: Anthropic, payload: unknown) {
  const res: any = await (client as any).beta.messages.create({
    model: JUDGE_MODEL,
    max_tokens: 8000,
    thinking: { type: "adaptive" },
    output_config: {
      effort: "medium",
      format: { type: "json_schema", schema: JUDGE_SCHEMA },
    },
    system: JUDGE_SYSTEM,
    messages: [{ role: "user", content: JSON.stringify(payload) }],
  });
  return JSON.parse(res.content.find((b: any) => b.type === "text").text);
}
