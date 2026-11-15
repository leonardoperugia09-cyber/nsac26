import type { CouplingRule } from "./types.ts";

// Sleep loss slows vigilance and accuracy; a high radiation day adds to it.
// "Workload" is not in the data yet.
export const cognitiveReadiness: CouplingRule = {
  id: "cognitive_readiness",
  name: "Cognitive readiness",
  signals: { sleep_hours: 1.2, sleep_debt_h: 0.8, reaction_time_ms: 1.2, memory_score: 1, radiation_mSv_today: 0.4, workload_1to5: 0.5 },
  needs: ["workload"],
  inputs: ["workload"],
  minLinked: 2,
  why: "Sleep loss and stress slow vigilance; radiation adds risk",
  source: "Nasrini et al. 2020; Barger et al. 2014",
  action: {
    watch: "Caution before a spacewalk or docking: re-test reaction time first.",
    act: "No-go for a spacewalk or docking until a re-test passes; rest now.",
  },
  bodyParts: ["mind"],
};
