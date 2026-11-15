// Shape of a coupling rule and of the named risk it produces.
// A coupling rule links several signals into ONE named risk. It only fires above Watch when
// several linked signals drift together, which keeps single noisy readings from raising alarms.

import type { Drift } from "../engine/baseline.ts";
import type { Level, MissionProfile, Reading } from "../engine/types.ts";

export type RuleInput = {
  day: number;
  today: Reading;
  drift: Record<string, Drift>; // from computeDrift() in src/engine/baseline.ts
  profile: MissionProfile;
  /** Which logged inputs are present today (symptom check, vision self-report, workload) */
  provided?: Set<string>;
};

export type CouplingRule = {
  id: string;
  name: string;
  signals: Record<string, number>; // signal key (field in crew_sim.json) -> weight
  needs?: string[]; // inputs the rule wants that the data doesn't have yet (lowers confidence)
  /** Logged inputs that answer `needs`: once logged, "Missing inputs" is no longer reported */
  inputs?: ("symptoms" | "vision" | "workload")[];
  /** What each logged input answers, so only what is still not logged is reported as missing */
  inputNeeds?: Partial<Record<"symptoms" | "vision" | "workload", string[]>>;
  minLinked: number; // how many signals must drift together for Act
  why: string; // the physiological link, one line
  source: string;
  action: { watch: string; act: string };
  bodyParts: string[]; // matches BodySystemId in src/ui/viewTypes.ts
  /** Optional custom scoring instead of the default coupled drift score. */
  score?: (inp: RuleInput) => { score: number; contributors: Contributor[] };
};

export type Contributor = { signal: string; label: string; score: number };

export type RiskResult = {
  ruleId: string;
  name: string;
  level: Level; // "Nominal" | "Watch" | "Act"
  score: number; // 0 = calm, 2.5+ = Watch, 4+ = Act (DEMO thresholds)
  range: [number, number]; // uncertainty band around the score
  contributors: Contributor[]; // drifting signals behind the risk, biggest first
  linked: number; // how many signals are drifting together
  why: string;
  action: string; // what to do at this level
  source: string;
  uncertainty: string[]; // "Why is HALO unsure?"
  bodyParts: string[];
};
