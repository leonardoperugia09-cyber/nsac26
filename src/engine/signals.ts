// The signals HALO watches, and how to judge each one.
//
// badDirection: +1 = rising is bad, -1 = falling is bad, 0 = both directions are bad.
// minSd: the smallest "normal spread" we allow, so a very steady signal doesn't turn tiny noise
//        into a huge drift score (DEMO values).
// expectedPerDay / expectedPctPerDay: change that EVERY astronaut gets in flight, from published rates.
//        The personal band slides along this path, so normal spaceflight decline is not flagged —
//        only changing FASTER than the research predicts is.

export type SignalDef = {
  key: string; // field name in data/crew_sim.json
  label: string;
  unit: string;
  badDirection: 1 | -1 | 0;
  minSd: number;
  expectedPerDay?: number; // in the signal's own units
  expectedPctPerDay?: number; // as % of the person's baseline
  /** false = score only how far today is, not the 7-day trend (for spiky signals such as radiation) */
  trend?: boolean;
};

export const SIGNALS: SignalDef[] = [
  // Vitals
  { key: "heart_rate", label: "Resting heart rate", unit: "bpm", badDirection: 0, minSd: 2 },
  { key: "bp_sys", label: "Systolic blood pressure", unit: "mmHg", badDirection: 0, minSd: 4 },
  { key: "bp_dia", label: "Diastolic blood pressure", unit: "mmHg", badDirection: 0, minSd: 3 },
  { key: "temp_c", label: "Body temperature", unit: "°C", badDirection: 1, minSd: 0.15, expectedPerDay: 0.008 }, // ~+0.6 C over 75 days in flight (Stahn et al. 2017)
  { key: "spo2", label: "Blood oxygen (SpO2)", unit: "%", badDirection: -1, minSd: 0.7 },
  { key: "glucose_mg_dl", label: "Blood sugar", unit: "mg/dL", badDirection: 0, minSd: 6 },

  // Sleep, mind, cognition
  { key: "sleep_hours", label: "Sleep", unit: "h", badDirection: -1, minSd: 0.5 },
  { key: "sleep_debt_h", label: "Sleep debt", unit: "h", badDirection: 1, minSd: 0.8 },
  { key: "mood_1to5", label: "Mood", unit: "/5", badDirection: -1, minSd: 0.5 },
  { key: "stress_1to5", label: "Stress", unit: "/5", badDirection: 1, minSd: 0.5 },
  { key: "reaction_time_ms", label: "Reaction time", unit: "ms", badDirection: 1, minSd: 10 },
  { key: "memory_score", label: "Memory test", unit: "/100", badDirection: -1, minSd: 3 },

  // Fluids and kidneys
  { key: "fluid_intake_ml", label: "Fluid intake", unit: "ml", badDirection: -1, minSd: 150 },
  { key: "urine_color_1to8", label: "Urine colour", unit: "/8", badDirection: 1, minSd: 0.6 },
  { key: "sodium_mg", label: "Sodium intake", unit: "mg", badDirection: 1, minSd: 250 },

  // Bone, muscle, nutrition — these decline for everyone in flight, so they use expected rates
  { key: "bone_density_pct", label: "Bone density", unit: "% of pre-flight", badDirection: -1, minSd: 0.3, expectedPerDay: -0.037 }, // ~1.1%/month with daily exercise (NASA)
  { key: "bone_resorption_index", label: "Bone breakdown marker", unit: "index", badDirection: 1, minSd: 5, expectedPerDay: 0.66 }, // rises with the expected bone loss
  { key: "calf_volume_pct", label: "Calf muscle volume", unit: "% of pre-flight", badDirection: -1, minSd: 0.3, expectedPerDay: -0.064 }, // -13% in 6 months (Trappe et al.)
  { key: "exercise_min", label: "Exercise", unit: "min", badDirection: -1, minSd: 15 },
  { key: "body_mass_kg", label: "Body mass", unit: "kg", badDirection: -1, minSd: 0.3, expectedPctPerDay: -0.05 }, // crews eat ~80% of need (Smith et al.)
  { key: "kcal_eaten", label: "Calories eaten", unit: "kcal", badDirection: -1, minSd: 120 },
  { key: "vitamin_d_ng_ml", label: "Vitamin D", unit: "ng/mL", badDirection: -1, minSd: 0.5, expectedPerDay: -0.08 }, // no sunlight in a spacecraft (DEMO rate)

  // Radiation
  // Radiation is the environment, not the body: everyone in the same ship gets roughly the same dose, and its
  // normal day-to-day spread is known (MSL RAD 1.75 +/- 0.30 mSv/day in cruise, Guo et al. 2015). So the
  // band is never narrower than that spread, and the 7-day trend is ignored (a storm spike would otherwise
  // keep the score high for a week after it ends). Storms themselves are caught by the solar storm rule.
  { key: "radiation_mSv_today", label: "Radiation today", unit: "mSv", badDirection: 1, minSd: 0.3, trend: false },
];

export const SIGNAL_BY_KEY: Record<string, SignalDef> = Object.fromEntries(SIGNALS.map((s) => [s.key, s]));
