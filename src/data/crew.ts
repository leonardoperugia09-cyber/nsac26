// Loads the simulated crew data once. Field names are the shared contract in src/engine/types.ts.
import raw from "../../data/crew_sim.json";
import { measurementsOn } from "../shared/measurements.ts";
import type {
  CrewMember,
  MissionProfile,
  Reading,
  SimData,
} from "../engine/types.ts";

export const SIM = raw as unknown as SimData;

/** The demo story is told on mission day 58 (after the planted day-55 fluid drop). */
export const DEMO_DAY = 58;

export const MISSION_PROFILE =
  (SIM.meta.mission_profile as MissionProfile) ?? "mars_transit";

export const crewById = (id: string): CrewMember =>
  SIM.crew.find((c) => c.id === id) ?? SIM.crew[0];

function logs(): any[] {
  try {
    return typeof localStorage === "undefined"
      ? []
      : JSON.parse(localStorage.getItem("halo-checkins-v1") ?? "[]");
  } catch {
    return [];
  }
}
export const historyOf = (crewId: string): Reading[] => {
  const overrides = new Map(
    logs()
      .filter((l) => l.crewId === crewId)
      .map((l) => [l.day, l.measurements]),
  );
  return SIM.readings
    .filter((r) => r.crew_id === crewId)
    .map((r) => {
      const row = { ...r, ...overrides.get(r.day) };
      for (const [type, key] of [
        ["reaction", "reaction_time_ms"],
        ["memory", "memory_score"],
      ]) {
        try {
          const values =
            typeof localStorage === "undefined"
              ? null
              : JSON.parse(
                  localStorage.getItem(
                    `halo-test-${crewId}-${r.day}-${type}`,
                  ) ?? "null",
                );
          if (Array.isArray(values) && values.length)
            (row as any)[key] =
              values.reduce((a: number, b: number) => a + b, 0) / values.length;
        } catch {}
      }
      // Instrument readings (strap, file import) replace the simulated value for that day and signal
      for (const [signal, m] of measurementsOn(crewId, r.day)) (row as any)[signal] = m.value;
      return row;
    })
    .sort((a, b) => a.day - b.day);
};

/** Where a value came from: an instrument reading for that day, or null when it is the simulator's. */
export const sourceOf = (crewId: string, signal: string, day: number) => measurementsOn(crewId, day).get(signal) ?? null;
export const readingOn = (crewId: string, day: number): Reading | undefined =>
  historyOf(crewId).find((r) => r.day === day);

export function contextOf(crewId: string, day: number): Record<string, any> {
  const log = logs().find((l) => l.crewId === crewId && l.day === day) ?? {};
  let vision;
  try {
    vision =
      typeof localStorage === "undefined"
        ? null
        : JSON.parse(
            localStorage.getItem(`halo-test-${crewId}-${day}-vision`) ?? "null",
          )?.[0];
  } catch {}
  return { ...log, vision_score: vision };
}
