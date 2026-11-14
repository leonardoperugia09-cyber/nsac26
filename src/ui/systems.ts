// The body systems HALO tracks: which signals belong to each, which body-map layer shows it,
// and why it matters in space (numbers from the NSAC master plan, p. 4-6, with their sources).
// Status grouping is presentation only; risk logic stays in the engine.
import {
  computeBaselines,
  computeDrift,
  type Drift,
} from "../engine/baseline.ts";
import { historyOf } from "../data/crew.ts";
import type { BodySystemId, SystemStatus } from "./viewTypes.ts";

export type Hazard =
  "Radiation" | "Isolation" | "Distance" | "Gravity" | "Environment";
export type Layer = "organs" | "skeleton" | "muscles";

export type SystemDef = {
  id: BodySystemId;
  label: string;
  layer: Layer;
  signals: string[]; // field names from data/crew_sim.json
  hazards: Hazard[];
  why: string;
  source: string;
};

export const SYSTEMS: SystemDef[] = [
  {
    id: "mind",
    label: "Sleep and mind",
    layer: "organs",
    hazards: ["Isolation", "Radiation"],
    signals: [
      "sleep_hours",
      "sleep_debt_h",
      "mood_1to5",
      "stress_1to5",
      "reaction_time_ms",
      "memory_score",
    ],
    why: "ISS crews get about 6 h of the 8.5 h scheduled. One night without sleep slowed vigilance and accuracy in NASA analog crews.",
    source: "Barger et al. 2014; Nasrini et al. 2020",
  },
  {
    id: "eyes",
    label: "Eyes",
    layer: "organs",
    hazards: ["Gravity"],
    signals: [],
    why: "About 66% of long-duration astronauts show early signs of SANS, caused by fluid shifting toward the head.",
    source: "NASA NTRS, SANS brief",
  },
  {
    id: "lungs",
    label: "Lungs and oxygen",
    layer: "organs",
    hazards: ["Environment"],
    signals: ["spo2"],
    why: "Blood oxygen shows whether cabin air and your lungs keep up. HALO flags drops against your own normal, not an Earth range.",
    source: "Demo threshold (HALO)",
  },
  {
    id: "heart",
    label: "Heart and blood",
    layer: "organs",
    hazards: ["Gravity"],
    signals: ["heart_rate", "bp_sys", "bp_dia"],
    why: "Fluid shifts change blood pressure and flow. 6 of 11 ISS crew had stagnant or reversed neck-vein flow; one had a clot.",
    source: "Marshall-Goebel et al. 2019",
  },
  {
    id: "kidneys",
    label: "Kidneys",
    layer: "organs",
    hazards: ["Gravity", "Environment"],
    signals: ["fluid_intake_ml", "urine_color_1to8", "sodium_mg"],
    why: "Kidney stones are 2 to 7 times more common after flight. Low fluid plus calcium released from bone drives the risk.",
    source: "Siew et al. 2024",
  },
  {
    id: "gut",
    label: "Gut and nutrition",
    layer: "organs",
    hazards: ["Environment"],
    signals: ["kcal_eaten", "body_mass_kg", "vitamin_d_ng_ml"],
    why: "ISS crews ate about 80% of the energy they needed, and vitamin D falls with no sunlight.",
    source: "Smith et al., NASA",
  },
  {
    id: "bones",
    label: "Bones",
    layer: "skeleton",
    hazards: ["Gravity"],
    signals: ["bone_density_pct", "bone_resorption_index"],
    why: "Weight-bearing bones like hip and spine lose 1 to 1.5% density per month without load.",
    source: "NASA; National Academies",
  },
  {
    id: "muscles",
    label: "Muscles",
    layer: "muscles",
    hazards: ["Gravity"],
    signals: ["calf_volume_pct", "exercise_min", "resistance_load_kg"],
    why: "Calf volume fell 13% and peak power 32% after 6 months on the ISS, despite daily exercise.",
    source: "Trappe et al.",
  },
];

export const SYSTEM_BY_ID = Object.fromEntries(
  SYSTEMS.map((s) => [s.id, s]),
) as Record<BodySystemId, SystemDef>;

/** Engine drift for every signal of one astronaut on one day. */
export function driftOn(crewId: string, day: number): Record<string, Drift> {
  const history = historyOf(crewId);
  return computeDrift(history, computeBaselines(history), day);
}

const statusOf = (d?: Drift): SystemStatus =>
  !d ? "unknown" : d.status === "inside band" ? "normal" : "watch";

/** Worst status among a system's signals; "unknown" if it has no readings. */
export function systemStatus(
  def: SystemDef,
  drift: Record<string, Drift>,
): SystemStatus {
  const statuses = def.signals.map((k) => statusOf(drift[k]));
  if (statuses.some((s) => s === "unknown")) return "unknown";
  if (statuses.length === 0) return "unknown";
  return statuses.includes("watch") ? "watch" : "normal";
}
