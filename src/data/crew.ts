// The crew data: the bundled simulation, or a scenario edited in Settings (re-simulated in the browser).
// Field names are the shared contract in src/engine/types.ts.
import raw from "../../data/crew_sim.json";
import { measurementsOn } from "../shared/measurements.ts";
import { api } from "../shared/api.ts";
import { DEFAULT_EVENTS, simulate, type SimEvent } from "../sim/simulator.ts";
import { withYou } from "./you.ts";
import type {
  CrewMember,
  MissionProfile,
  Reading,
  SimData,
} from "../engine/types.ts";

const BUNDLED = raw as unknown as SimData;
const SCENARIO_KEY = "halo-sim-custom-v1";
/** The demo story is told on mission day 58 (after the planted day-55 fluid drop). */
const BUNDLED_DAY = 58;

/** Only the scenario is stored (a few KB); the readings are re-simulated from it, same seed, same data */
export type Scenario = { crew: CrewMember[]; events: SimEvent[]; today: number };

function storedScenario(): Scenario | null {
  try {
    const s = typeof localStorage === "undefined" ? null : JSON.parse(localStorage.getItem(SCENARIO_KEY) ?? "null");
    return s && Array.isArray(s.crew) && s.crew.length === 3 && Array.isArray(s.events) && Number.isInteger(s.today) ? s : null;
  } catch {
    return null;
  }
}
const stored = storedScenario();

// Live bindings: every module that reads SIM or DEMO_DAY sees the scenario after a run or reset
let custom = !!stored;
// Every dataset also carries the empty "You" profile (src/data/you.ts)
export let SIM: SimData = withYou(stored ? simulate(stored.crew, stored.events) : BUNDLED);
export let DEMO_DAY = stored?.today ?? BUNDLED_DAY;

export const isCustomScenario = () => custom;
/** What the Settings editor starts from: the stored scenario, or the bundled crew with today's planted events */
export const scenarioOf = (): Scenario =>
  storedScenario() ?? { crew: BUNDLED.crew, events: DEFAULT_EVENTS, today: BUNDLED_DAY };

/** The HALO server (when it runs) uses the same data, so the assistant and exports match the screen */
export function syncScenario() {
  const s = storedScenario();
  if (s) api("/scenario", { crew: s.crew, events: s.events, today: s.today }).catch(() => {});
}

/** Run the simulation for an edited scenario, keep it on this device and tell every view to recompute */
export function saveScenario(s: Scenario) {
  SIM = withYou(simulate(s.crew, s.events));
  custom = true;
  DEMO_DAY = s.today;
  try { localStorage.setItem(SCENARIO_KEY, JSON.stringify(s)); } catch { /* storage blocked: this session only */ }
  window.dispatchEvent(new Event("halo-data-change"));
  syncScenario();
}

/** Back to the bundled demo data, here and on the server */
export function resetScenario() {
  SIM = withYou(BUNDLED);
  custom = false;
  DEMO_DAY = BUNDLED_DAY;
  try { localStorage.removeItem(SCENARIO_KEY); } catch { /* nothing stored */ }
  window.dispatchEvent(new Event("halo-data-change"));
  api("/scenario/reset", {}).catch(() => {});
}

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
