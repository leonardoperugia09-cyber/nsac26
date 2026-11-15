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

/** The astronaut's own numbers for the day, when the caller has them. */
export type TopicFacts = {
  reading?: Record<string, unknown>;
  drift?: Record<
    string,
    { value: number; bandLo: number; bandHi: number; status: string }
  >;
};

const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;
const round = (n: number, digits = 1) => String(Number(n.toFixed(digits)));

export function topicAnswer(
  question: string,
  priority: Priority,
  facts: TopicFacts = {},
): TopicAnswer | null {
  const q = question.toLowerCase();
  if (/what (should|do|can) i do|what now|next step/.test(q)) {
    return {
      text: priority
        ? `${priority.name} is at ${priority.level}.`
        : "No linked risk is active right now.",
      action:
        priority?.ruleId === "kidney_stone"
          ? "Follow the hydration plan shown on the Overview, ask your crew medical officer about it, and log your urine colour tonight."
          : priority
            ? priority.action
            : "Nothing needs action now. Do today's check-in in Daily Log.",
      evidenceIds: priority?.evidenceIds ?? ["nasa_body"],
    };
  }
  if (q.includes("headache")) {
    return {
      text: "Was it sudden and severe, or does it come with vision change, confusion or weakness? If yes, use Urgent help now. If not, headaches in space often come from fluid shifting toward the head or from cabin CO2.",
      action:
        "Note it in Daily Log, with when it started. Tell your crew medical officer if it keeps coming back.",
      evidenceIds: ["nasa_body"],
    };
  }
  if (/dizz|light-?headed|faint|woozy/.test(q)) {
    return {
      text: "Feeling dizzy when you stand up is common in space. Fluids shift toward the head in microgravity, and after a while the body is slower to adjust when you move upright (orthostatic intolerance).",
      action:
        "Sit or lie down until it passes. Drink fluids as normal, log it in Daily Log and tell your crew medical officer. If you faint, or have chest pain or palpitations, use Urgent help.",
      evidenceIds: ["nasa_body"],
    };
  }
  if (/radiation/.test(q) && /dose|so far|total|exposure|msv/.test(q)) {
    const total = num(facts.reading?.radiation_mSv_total);
    const today = num(facts.reading?.radiation_mSv_today);
    if (total !== null)
      return {
        text: `Your simulated radiation dose so far is ${round(total, 2)} mSv${today !== null ? `, with ${round(today, 2)} mSv logged today` : ""}. These are simulated values for this demo.`,
        action:
          "Ask your crew medical officer how this compares with the mission limit, and check the Overview for any radiation pattern.",
        evidenceIds: ["radlab_api"],
      };
  }
  if (/dark urine|urine.*dark|urine colou?r/.test(q)) {
    const color = num(facts.reading?.urine_color_1to8);
    const fluid = num(facts.reading?.fluid_intake_ml);
    if (color !== null)
      return {
        text: `Today you logged urine colour ${round(color)} of 8${fluid !== null ? ` and fluid intake of ${round(fluid, 0)} ml` : ""}. Darker numbers can mean you are drinking less than you lose, which matters over several days, not one reading.`,
        action:
          "Keep logging urine colour in Daily Log and tell your crew medical officer if it stays dark for days.",
        evidenceIds: ["kidney_2024"],
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
    const night = facts.drift?.sleep_hours;
    if (night)
      return {
        text: `Last night you slept ${round(night.value)} hours. Your normal range is ${round(night.bandLo)} to ${round(night.bandHi)} hours. One short night slows reaction time.`,
        action:
          "Take the reaction test before any spacewalk or docking. Tonight, dim the lights an hour before sleep and keep your schedule fixed.",
        evidenceIds: ["sleep_2014"],
      };
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
