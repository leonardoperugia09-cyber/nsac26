import type { CouplingRule } from "./types.ts";

// One headward fluid shift drives both SANS (eye changes) and neck-vein stasis.
// Our simulated data has no headache, puffy-face or vision readings yet, so this rule
// stays low-confidence and says so in "Why is HALO unsure?".
export const fluidShift: CouplingRule = {
  id: "fluid_shift",
  name: "Fluid shift syndrome",
  // Logged symptoms and a low vision self-report count like drifting signals (DEMO weights, src/engine/risks.ts)
  signals: { bp_sys: 0.6, bp_dia: 0.6, heart_rate: 0.5, symptom_headache: 0.6, symptom_puffy_face: 0.6, symptom_blurred_vision: 0.8, vision_selfreport: 0.8 },
  needs: ["headache log", "puffy face check", "vision check score"],
  inputs: ["symptoms", "vision"],
  minLinked: 2,
  why: "One headward fluid shift drives both SANS and neck-vein stasis",
  source: "NASA NTRS SANS brief; Marshall-Goebel et al. 2019",
  action: {
    watch: "Do the weekly vision self-test today and log any headache.",
    act: "Report blurred vision to the crew medical officer at once.",
  },
  bodyParts: ["eyes", "heart"],
};
