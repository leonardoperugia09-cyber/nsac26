import type { CouplingRule } from "./types.ts";

// Stress hormones and poor sleep let latent viruses wake up.
// Skin symptoms and cold sores are not in the data yet.
export const immuneStrain: CouplingRule = {
  id: "immune_strain",
  name: "Immune strain",
  signals: { sleep_debt_h: 1, stress_1to5: 1, mood_1to5: 0.6, symptom_cold_sore: 0.8, symptom_skin_symptoms: 0.6 },
  needs: ["skin symptoms", "cold sores"],
  inputs: ["symptoms"],
  inputNeeds: { symptoms: ["skin symptoms", "cold sores"] },
  minLinked: 2,
  why: "Stress hormones let latent viruses wake up",
  source: "Rooney et al. 2019",
  action: {
    watch: "Rest first, keep up hygiene, log any symptoms.",
    act: "Rest priority today; log symptoms daily and tell the crew medical officer.",
  },
  bodyParts: ["mind"],
};
