// Builds what the Overview shows for one astronaut on one mission day.
// Bands and drift come from the engine (src/engine/baseline.ts). Which risk shows, and how strongly, comes from the
// shared assessment (src/engine/assessment.ts), the same one the backend serves, for every astronaut and day.
// Only the wording and the plan per rule are written here; the "why" is built from the readings themselves.
import { bandCentreAt, computeBaselines, computeDrift } from "../engine/baseline.ts";
import { SIGNAL_BY_KEY } from "../engine/signals.ts";
import { MISSION_PROFILE, contextOf, historyOf, sourceOf } from "../data/crew.ts";
import { STALE_AFTER_DAYS } from "../bodymap/model.ts";
import { assessCrew } from "../engine/assessment.ts";
import type { BodySystem, LinkedSeries, OverviewModel, PriorityRisk, ReadingSummary, Task } from "./viewTypes.ts";
import { SYSTEMS, systemStatus } from "./systems.ts";
import { joinAnd } from "./text.ts";
import { isInputKey } from "../engine/risks.ts";

// How a rule reads on the Overview. A rule without copy here falls back to the engine's own wording.
const RULE_COPY: Record<string, { title: string; actTitle: string; short: string; together: string; plan: PriorityRisk["plan"] }> = {
  kidney_stone: {
    title: "Kidney stone risk is rising",
    actTitle: "Kidney stone risk is high",
    short: "Less water, more salt and faster bone loss: together they form kidney stones in space.",
    together: "Together, that is how kidney stones form in microgravity.",
    plan: [
      { id: "water1", label: "Drink 250 ml", when: "Now", cta: "I drank 250 ml", clears: true },
      { id: "water2", label: "Drink another 250 ml", when: "Before 16:00", cta: "I drank another 250 ml", clears: true },
      { id: "urine", label: "Log urine colour", when: "Before sleep", cta: "I logged my urine colour" },
    ],
  },
};

const SHORT_LABEL: Record<string, string> = { bone_resorption_index: "Bone breakdown", sodium_mg: "Sodium intake" };

/** Has this daily test been done on this day? (Daily Log saves results per astronaut and day) */
const testDone = (crewId: string, day: number, type: string) => {
  try { return typeof localStorage !== "undefined" && !!localStorage.getItem(`halo-test-${crewId}-${day}-${type}`); } catch { return false; }
};

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
  const assessment = assessCrew(history, day, MISSION_PROFILE, contextOf(crewId, day));
  const r = assessment.priority;
  // First day of the unbroken run outside the band, for the chart's event line
  const outSince = (key: string) => {
    const b = bands[key];
    if (!b) return day;
    const bad = SIGNAL_BY_KEY[key]?.badDirection ?? 0;
    let since = day;
    for (const row of [...history].filter((x) => x.day <= day && x.day > day - 30).sort((a, b2) => b2.day - a.day)) {
      const v = (row as Record<string, unknown>)[key];
      if (typeof v !== "number") break;
      const c = bandCentreAt(b, row.day), lo = c - 2 * b.sd, hi = c + 2 * b.sd;
      const isOut = bad < 0 ? v < lo : bad > 0 ? v > hi : v < lo || v > hi;
      if (!isOut) break;
      since = row.day;
    }
    return since;
  };
  const describe = (key: string) => {
    const d = drift[key];
    if (!d || d.status === "inside band") return null;
    // Quote today's reading, as the chart does; the engine may judge slow signals on a 3-day average
    const v = (history.find((x) => x.day === day) as Record<string, unknown> | undefined)?.[key];
    const { now, unit } = display(key, typeof v === "number" ? v : d.value);
    const side = d.value < d.bandLo ? "below" : "above";
    const shown = unit && unit !== "index" ? " " + unit : "";
    return `${SHORT_LABEL[key] ?? SIGNAL_BY_KEY[key]?.label ?? key} is ${now}${shown}, ${side} your normal`;
  };
  const copy = r ? RULE_COPY[r.ruleId] : undefined;
  const reported = r
    ? r.contributors.filter((c) => isInputKey(c.signal)).map((c) => c.label.replace(/ logged$/, "").toLowerCase())
    : [];
  const signals = r ? r.contributors.map((c) => c.signal).filter((k) => bands[k]) : [];
  const facts = signals.map(describe).filter(Boolean) as string[];
  const risk: PriorityRisk | null = r
    ? {
        ruleId: r.ruleId,
        title: copy?.title ?? r.name,
        actTitle: copy?.actTitle ?? r.name,
        level: r.level === "Act" ? "act" : "watch",
        sinceDay: Math.min(day, Math.max(1, day - r.persistence.observed + 1)),
        short: copy?.short ?? r.why + ".",
        why: [...facts, ...(reported.length ? [`You logged ${joinAnd(reported)} today`] : [])].length
          ? `${[...facts, ...(reported.length ? [`You logged ${joinAnd(reported)} today`] : [])].join(". ")}. ${copy?.together ?? r.why + "."}`
          : [r.why + ".", ...r.uncertainty].join(" "),
        action: copy?.plan[0]?.label ?? r.action,
        signals,
        eventDay: signals.length ? outSince(signals[0]) : day,
        eventLabel: signals.length ? `${(SHORT_LABEL[signals[0]] ?? SIGNAL_BY_KEY[signals[0]]?.label ?? "reading").toLowerCase()} left your normal` : "pattern began",
        otherRisks: assessment.risks.filter((x) => x.ruleId !== r.ruleId && (x.level === "Watch" || x.level === "Act")).map((x) => x.name.toLowerCase()),
        systemIds: r.bodyParts as PriorityRisk["systemIds"],
        plan: copy?.plan ?? [
          // The rule's own action first (e.g. "Report blurred vision to the crew medical officer at once")
          { id: r.ruleId + "-action", label: r.action.replace(/\.$/, ""), when: "Today", cta: "Done" },
          ...(/crew medical officer/i.test(r.action)
            ? []
            : [{ id: r.ruleId + "-review", label: "Review the linked readings with your crew medical officer", when: "Before any decision", cta: "I reviewed them" }]),
        ],
      }
    : null;
  // Today's routine, checked against what was actually logged that day
  const row = history.find((x) => x.day === day) as Record<string, unknown> | undefined;
  const tasks: Task[] = [
    { id: "workout", label: "Resistance workout", done: typeof row?.exercise_min === "number" && (row.exercise_min as number) >= 30 },
    { id: "reaction", label: "Reaction test", when: "3 minutes, in Daily Log", done: testDone(crewId, day, "reaction") },
    { id: "vision", label: "Vision self-test", when: "In Daily Log", done: testDone(crewId, day, "vision") },
  ];

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
    if (got.some((g) => !g)) return { label, value: "No reading", note, out: false, age: "Never measured", stale: true, signal: keys[0] };
    const oldest = Math.min(...got.map((g) => g!.day));
    // Where the value came from: an instrument (strap, file import) or the simulator
    const src = sourceOf(crewId, keys[0], got[0]!.day);
    const source = src ? (src.provenance === "simulated" ? src.sourceId : `${src.sourceId}`) : undefined;
    return { label, value: show(got.map((g) => g!.v)), unit, note, out: isOut, age: age(oldest), stale: day - oldest > STALE_AFTER_DAYS, signal: keys[0], source };
  };
  const totalDose = last("radiation_mSv_total");
  const readings: ReadingSummary[] = [
    reading("Heart rate", ["heart_rate"], ([v]) => String(Math.round(v)), "bpm", `Your normal ${range("heart_rate")}`, out("heart_rate")),
    reading("Blood pressure", ["bp_sys", "bp_dia"], ([a, b]) => `${Math.round(a)}/${Math.round(b)}`, undefined, `Your normal ${range("bp_sys")} / ${range("bp_dia")}`, out("bp_sys") || out("bp_dia")),
    reading("Sleep last night", ["sleep_hours"], ([v]) => v.toFixed(1), "h", `Your normal ${range("sleep_hours", 1)}`, out("sleep_hours")),
    reading("Radiation today", ["radiation_mSv_today"], ([v]) => v.toFixed(2), "mSv", totalDose ? `${Math.round(totalDose.v)} mSv this mission` : "", out("radiation_mSv_today")),
  ];

  return { risk, series, tasks, systems, readings };
}

/** Completing a plan records an action, never changes physiological severity. */
export const easedToday = (_risk: PriorityRisk | null, _done: string[]) =>
  false;
