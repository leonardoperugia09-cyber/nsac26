// View models the screens render. These are UI-side shapes only.
// The coupled-risk rules (src/rules) don't exist yet, so PriorityRisk, Task and
// the body-system grouping should move into the engine contract once they do.

export type RiskLevel = "normal" | "watch" | "act";
export type SystemStatus = RiskLevel | "unknown";

export type PriorityRisk = {
  /** Coupling rule in src/rules whose engine level drives this risk */
  ruleId: string;
  title: string;
  /** Title when the engine says Act: says it louder than "rising" */
  actTitle?: string;
  level: Exclude<RiskLevel, "normal">;
  sinceDay: number;
  why: string;
  /** One line shown in the hero; the full why opens behind "Why these are linked" */
  short: string;
  action: string;
  signals: string[]; // field names from data/crew_sim.json
  eventDay: number;
  eventLabel: string;
  otherRisks: string[];
  plan: PlanStep[]; // the to-do that answers this risk, in order
  systemIds: BodySystemId[]; // body systems this risk covers
};

/** `clears`: once every clearing step is done, today's Act warning steps down to Watch (the readings update tomorrow) */
export type PlanStep = { id: string; label: string; when: string; cta: string; clears?: boolean };

export type ChartPoint = { day: number; value: number; band: [number, number]; out: number | null };

export type LinkedSeries = {
  key: string;
  label: string;
  now: string;
  unit: string;
  outNow: boolean;
  points: ChartPoint[];
};

export type Task = { id: string; label: string; when?: string; done: boolean };

export type BodySystemId = "mind" | "eyes" | "lungs" | "heart" | "kidneys" | "gut" | "bones" | "muscles";

export type BodySystem = { id: BodySystemId; label: string; status: SystemStatus; detail: string };

/** `age`: "Today", "Yesterday" or "N days old"; `stale` once older than the body map's 3-day limit */
export type ReadingSummary = { label: string; value: string; unit?: string; note: string; out: boolean; age: string; stale: boolean; signal: string; source?: string };

export type OverviewModel = {
  risk: PriorityRisk | null;
  series: LinkedSeries[];
  tasks: Task[];
  systems: BodySystem[];
  readings: ReadingSummary[];
};
