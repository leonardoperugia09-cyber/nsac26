// "You": a fourth profile with no simulated values. Every number in it comes from what the person logs or
// imports (Daily Log, tests, symptoms, Apple Health export, a heart-rate strap). Unmeasured signals stay empty,
// so HALO says "not measured" instead of inventing them.
import type { CrewMember, Reading, SimData } from "../engine/types.ts";

export const YOU_ID = "U1";
export const isYou = (crewId: string) => crewId === YOU_ID;
// Age and sex are unknown and unused for this profile (they only feed the simulator)
export const YOU = {
  id: YOU_ID,
  name: "You",
  role: "Your own data",
  age: 0,
  baseline: {},
} as unknown as CrewMember;

const FLAGS = new Set([
  "crew_id",
  "day",
  "events",
  "sleep_med_taken",
  "in_storm_shelter",
  "eva_scheduled",
]);

/** Adds the empty "You" profile (120 empty days) to a dataset that does not have it yet */
export function withYou(d: SimData): SimData {
  if (d.crew.some((c) => c.id === YOU_ID)) return d;
  const keys = Object.keys(d.readings[0] ?? {}).filter((k) => !FLAGS.has(k));
  const days = Number(d.meta.days ?? 120);
  const rows = Array.from({ length: days }, (_, i) => ({
    crew_id: YOU_ID,
    day: i + 1,
    ...Object.fromEntries(keys.map((k) => [k, null])),
    sleep_med_taken: false,
    in_storm_shelter: false,
    eva_scheduled: false,
    events: [],
  })) as unknown as Reading[];
  return { ...d, crew: [...d.crew, YOU], readings: [...d.readings, ...rows] };
}
