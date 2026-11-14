// Curated answers for the questions crews ask most. Shared by the HALO server (backend/node/assistant.ts)
// and the on-board fallback (src/shared/offlineAssistant.ts), so both always say the same thing.
// Checked only after emergency triage and the medication refusal.

type Priority =
  | {
      ruleId: string;
      name: string;
      level: string;
      action: string;
      evidenceIds?: string[];
    }
  | null
  | undefined;

export type TopicAnswer = {
  text: string;
  action: string;
  evidenceIds: string[];
};

/** The marker the app uses to show the next step on its own line */
export const ACTION_MARK = "What to do now:";

export function topicAnswer(
  question: string,
  priority: Priority,
): TopicAnswer | null {
  const q = question.toLowerCase();
  if (/what (should|do|can) i do|what now|next step/.test(q)) {
    return {
      text: priority
        ? `${priority.name} is at ${priority.level}.`
        : "No linked risk is active right now.",
      action:
        priority?.ruleId === "kidney_stone"
          ? "Drink 500 ml over the next hour, and log your urine colour tonight."
          : priority
            ? priority.action
            : "Nothing needs action now. Do today's check-in in Daily Log.",
      evidenceIds: priority?.evidenceIds ?? ["nasa_body"],
    };
  }
  if (q.includes("headache")) {
    return {
      text: "No red flags: it isn't described as sudden or severe, and no vision change is reported. In space, headaches often come from fluid shifting toward the head or from cabin CO2.",
      action:
        "Drink some water and note it in Daily Log. If it becomes sudden and severe, or your vision changes, use Urgent help.",
      evidenceIds: ["nasa_body"],
    };
  }
  if (/blurr|vision|eyesight/.test(q)) {
    return {
      text: "Blurred vision can be an early sign of SANS, when fluid shifting toward the head affects the eye. About 66% of long-duration astronauts show early signs.",
      action:
        "Do the vision self-test in Daily Log today and tell your crew medical officer. If you suddenly lose vision, use Urgent help.",
      evidenceIds: ["nasa_body"],
    };
  }
  if (/sleep|slept|insomnia|tired/.test(q)) {
    return {
      text: "Most crews sleep about 6 hours in space. One short night slows reaction time.",
      action:
        "Take the reaction test before any spacewalk or docking. Tonight, dim the lights an hour before sleep and keep your schedule fixed.",
      evidenceIds: ["sleep_2014"],
    };
  }
  return null;
}

/** One explanation string for the API contract: the answer, then the next step after the marker */
export const topicText = (t: TopicAnswer) =>
  `${t.text} ${ACTION_MARK} ${t.action}`;
