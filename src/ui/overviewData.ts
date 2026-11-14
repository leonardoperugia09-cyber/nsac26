// Builds what the Overview shows for one astronaut on one mission day.
// Bands and drift come from the engine (src/engine/baseline.ts). The priority risk text and the
// task list are MOCK; the risk level comes from the shared assessment (src/engine/assessment.ts), the same one the backend serves.
import { bandCentreAt, computeBaselines, computeDrift } from "../engine/baseline.ts";
import { SIGNAL_BY_KEY } from "../engine/signals.ts";
import { MISSION_PROFILE, contextOf, historyOf } from "../data/crew.ts";
import { STALE_AFTER_DAYS } from "../bodymap/model.ts";
import { assessCrew } from "../engine/assessment.ts";
import type { BodySystem, LinkedSeries, OverviewModel, PriorityRisk, ReadingSummary, Task } from "./viewTypes.ts";
import { SYSTEMS, systemStatus } from "./systems.ts";

// MOCK: what the kidney-stone coupling rule (brief p. 7, Siew et al. 2024) would return for Marco.
const RISKS: Record<string, PriorityRisk> = {
  C2: {
    ruleId: "kidney_stone",
    title: "Kidney stone risk is rising",
    actTitle: "Kidney stone risk is high",
    level: "watch",
    sinceDay: 55,
    short: "Less water, more salt and faster bone loss: together they form kidney stones in space.",
    why: "Your fluid intake fell by half on Day 55. Since then your urine has darkened, you are eating more salt, and your bone breakdown marker keeps climbing. Together, that is how kidney stones form in microgravity.",
    action: "Drink 500 ml more today",
    signals: ["fluid_intake_ml", "urine_color_1to8", "sodium_mg", "bone_resorption_index"],
    eventDay: 55,
    eventLabel: "intake dropped",
    otherRisks: ["cognitive readiness", "bone and muscle loss", "fluid shift", "solar storm"],
    systemIds: ["kidneys"],
    plan: [
      { id: "water1", label: "Drink 250 ml", when: "Now", cta: "I drank 250 ml", clears: true },
      { id: "water2", label: "Drink another 250 ml", when: "Before 16:00", cta: "I drank another 250 ml", clears: true },
      { id: "urine", label: "Log urine colour", when: "Before sleep", cta: "I logged my urine colour" },
    ],
  },
};

// MOCK: the day's routine until a schedule source exists.
const TASKS: Task[] = [
  { id: "workout", label: "Resistance workout", done: true },
  { id: "reaction", label: "Reaction test", when: "3 minutes, before 18:00", done: false },
  { id: "vision", label: "Vision self-test", when: "Overdue, last done 9 days ago", done: false },
];

const SHORT_LABEL: Record<string, string> = { bone_resorption_index: "Bone breakdown", sodium_mg: "Sodium intake" };

function display(key: string, v: number): { now: string; unit: string } {
  switch (key) {
    case "fluid_intake_ml": return { now: (v / 1000).toFixed(2), unit: "L" };
    case "urine_color_1to8": return { now: String(Math.round(v)), unit: "of 8" };
    case "sodium_mg": return { now: Math.round(v).toLocaleString("en-US"), unit: "mg" };
    default: return { now: String(Math.round(v)), unit: SIGNAL_BY_KEY[key]?.unit ?? "" };
  }
}

export function buildOverview(crewId: string, day: number): OverviewModel {
  const history = historyOf(crewId);
  const bands = computeBaselines(history);
  const drift = computeDrift(history, bands, day);
  // The engine decides the level ("far outside" can reach Act); no engine risk above Nominal means no hero risk
  const mock = RISKS[crewId];
  const engine = mock ? assessCrew(history, day, MISSION_PROFILE, contextOf(crewId, day)).risks.find((r) => r.ruleId === mock.ruleId) : undefined;
  const level = engine?.level === "Act" ? "act" : engine?.level === "Watch" ? "watch" : null;
  const risk: PriorityRisk | null = mock && level ? { ...mock, level } : null;

  const from = day - 14;
  const series: LinkedSeries[] = (risk?.signals ?? []).map((key) => {
    const b = bands[key];
    const bad = SIGNAL_BY_KEY[key]?.badDirection ?? 0;
    const rows = history.filter((r) => r.day >= from && r.day <= day);
    const pts = rows.map((r) => {
      const value = r[key as keyof typeof r] as number;
      const c = bandCentreAt(b, r.day);
      const band: [number, number] = [c - 2 * b.sd, c + 2 * b.sd];
      const isOut = bad < 0 ? value < band[0] : bad > 0 ? value > band[1] : value < band[0] || value > band[1];
      return { day: r.day, value, band, isOut };
    });
    // A segment is drawn amber when it ends outside the band, so include its start point too.
    const points = pts.map((p, i) => ({
      day: p.day, value: p.value, band: p.band,
      out: p.isOut || pts[i + 1]?.isOut ? p.value : null,
    }));
    const last = pts[pts.length - 1];
    return { key, label: SHORT_LABEL[key] ?? SIGNAL_BY_KEY[key]?.label ?? key, ...display(key, last.value), outNow: last.isOut, points };
  });

  const statusText = { normal: "Normal", watch: "Watch", act: "Act", unknown: "No reading yet" } as const;
  const systems: BodySystem[] = SYSTEMS.map((def) => {
    const status = systemStatus(def, drift);
    return { id: def.id, label: def.label, status, detail: statusText[status] };
  });

  const range = (k: string, digits = 0) => (drift[k] ? `${drift[k].bandLo.toFixed(digits)}-${drift[k].bandHi.toFixed(digits)}` : "not set yet");
  const out = (k: string) => !!drift[k] && drift[k].status !== "inside band";
  // Each reading shows its most recent real measurement and how old it is, never a silent gap
  const last = (key: string) => {
    for (const r of [...history].filter((x) => x.day <= day).sort((a, b) => b.day - a.day)) {
      const v = (r as Record<string, unknown>)[key];
      if (typeof v === "number" && Number.isFinite(v)) return { v, day: r.day };
    }
    return null;
  };
  const age = (d: number) => (d === day ? "Today" : d === day - 1 ? "Yesterday" : `${day - d} days old`);
  const reading = (label: string, keys: string[], show: (vals: number[]) => string, unit: string | undefined, note: string, isOut: boolean): ReadingSummary => {
    const got = keys.map(last);
    if (got.some((g) => !g)) return { label, value: "No reading", note, out: false, age: "Never measured", stale: true };
    const oldest = Math.min(...got.map((g) => g!.day));
    return { label, value: show(got.map((g) => g!.v)), unit, note, out: isOut, age: age(oldest), stale: day - oldest > STALE_AFTER_DAYS };
  };
  const totalDose = last("radiation_mSv_total");
  const readings: ReadingSummary[] = [
    reading("Heart rate", ["heart_rate"], ([v]) => String(Math.round(v)), "bpm", `Your normal ${range("heart_rate")}`, out("heart_rate")),
    reading("Blood pressure", ["bp_sys", "bp_dia"], ([a, b]) => `${Math.round(a)}/${Math.round(b)}`, undefined, `Your normal ${range("bp_sys")} / ${range("bp_dia")}`, out("bp_sys") || out("bp_dia")),
    reading("Sleep last night", ["sleep_hours"], ([v]) => v.toFixed(1), "h", `Your normal ${range("sleep_hours", 1)}`, out("sleep_hours")),
    reading("Radiation today", ["radiation_mSv_today"], ([v]) => v.toFixed(2), "mSv", totalDose ? `${Math.round(totalDose.v)} mSv this mission` : "", out("radiation_mSv_today")),
  ];

  return { risk, series, tasks: TASKS, systems, readings };
}

/** True once every clearing step of the plan is done today: the Act warning steps down to Watch. */
export const easedToday = (risk: PriorityRisk | null, done: string[]) =>
  !!risk && risk.plan.some((p) => p.clears) && risk.plan.filter((p) => p.clears).every((p) => done.includes(p.id));
