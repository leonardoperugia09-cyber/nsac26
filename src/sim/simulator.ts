// The crew simulator, ported from scripts/crew_simulator.py so it runs in the browser (the Cloudflare demo has no server).
// Same published rates and DEMO parameters as the Python script; the planted events are now an editable list.
// Same seed gives the same data, but the numbers are not bit-identical to the Python output (different random generator).
import type { CrewMember, Reading, SimData } from "../engine/types.ts";

export const DAYS = 120;
export const DEFAULT_SEED = 42;

export type SimEventType = "solar_storm" | "fluid_drop" | "short_night";
/** strength: solar storm = extra mSv on its first day; fluid drop = % less fluid; short night = hours slept */
export type SimEvent = { id: string; type: SimEventType; crewId: string; day: number; length?: number; strength: number };

export const EVENT_INFO: Record<SimEventType, { label: string; unit: string; min: number; max: number }> = {
  solar_storm: { label: "Solar storm", unit: "extra mSv", min: 1, max: 40 },
  fluid_drop: { label: "Fluid drop", unit: "% less", min: 10, max: 80 },
  short_night: { label: "Short night before a spacewalk", unit: "h sleep", min: 1, max: 6 },
};

/** Today's planted story: storm on day 40-41, Marco drinks less from day 55, Lena sleeps 3.4 h before the day-70 spacewalk */
export const DEFAULT_EVENTS: SimEvent[] = [
  { id: "storm", type: "solar_storm", crewId: "all", day: 40, length: 2, strength: 14 },
  { id: "fluid", type: "fluid_drop", crewId: "C2", day: 55, strength: 45 },
  { id: "night", type: "short_night", crewId: "C3", day: 70, strength: 3.4 },
];

/** The 12 personal normal values the simulator starts from, with sensible input limits */
export const BASELINE_FIELDS: { key: keyof CrewMember["baseline"] & string; label: string; unit: string; min: number; max: number; step: number }[] = [
  { key: "heart_rate", label: "Resting heart rate", unit: "bpm", min: 40, max: 100, step: 1 },
  { key: "bp_sys", label: "Blood pressure, upper", unit: "mmHg", min: 90, max: 160, step: 1 },
  { key: "bp_dia", label: "Blood pressure, lower", unit: "mmHg", min: 50, max: 100, step: 1 },
  { key: "temp_c", label: "Body temperature", unit: "°C", min: 35.5, max: 37.5, step: 0.1 },
  { key: "spo2", label: "Blood oxygen", unit: "%", min: 94, max: 100, step: 1 },
  { key: "glucose_mg_dl", label: "Blood sugar", unit: "mg/dL", min: 60, max: 140, step: 1 },
  { key: "body_mass_kg", label: "Body mass", unit: "kg", min: 40, max: 130, step: 0.5 },
  { key: "fluid_ml", label: "Fluid intake", unit: "ml a day", min: 1200, max: 4000, step: 50 },
  { key: "sodium_mg", label: "Sodium intake", unit: "mg a day", min: 1500, max: 8000, step: 50 },
  { key: "kcal_need", label: "Energy need", unit: "kcal a day", min: 1500, max: 4000, step: 50 },
  { key: "reaction_ms", label: "Reaction time", unit: "ms", min: 180, max: 400, step: 1 },
  { key: "vit_d_ng_ml", label: "Vitamin D", unit: "ng/mL", min: 10, max: 80, step: 1 },
];

// ---- Real rates (same as the Python script) ----
const BONE_LOSS_PER_MONTH: [number, number] = [1.0, 1.5];
const PLASMA_DROP: [number, number] = [10, 20];
const SLEEP_ACTUAL_MEAN = 6.0;
const MARS_CRUISE_DOSE = 1.8;
const CALF_LOSS_6_MONTHS = 13.0;
const INTAKE_FRACTION = 0.8;
const BP_SHIFT: [number, number] = [-8, -9];
const TEMP_RISE = 0.6;
const MASS_LOSS_FIRST_MONTH: [number, number] = [2.0, 4.0];
const DOSE_SD = 0.2;
const STORM_TAIL = 0.3; // DEMO: each further storm day brings 30% of the day before (14 then about 4 mSv, as the Python script)

/** Seeded generator (mulberry32) with uniform and Gaussian draws */
function rng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  let spare: number | null = null;
  const gauss = (mu: number, sd: number) => {
    if (spare !== null) { const s = spare; spare = null; return mu + sd * s; }
    let u = 0, v = 0;
    while (u === 0) u = next();
    v = next();
    const r = Math.sqrt(-2 * Math.log(u));
    spare = r * Math.sin(2 * Math.PI * v);
    return mu + sd * r * Math.cos(2 * Math.PI * v);
  };
  return { random: next, uniform: (lo: number, hi: number) => lo + (hi - lo) * next(), gauss };
}

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const round = (x: number, d = 0) => { const f = 10 ** d; return Math.round(x * f) / f; };
const applies = (e: SimEvent, crewId: string) => e.crewId === "all" || e.crewId === crewId;

function simulateMember(m: CrewMember, events: SimEvent[], r: ReturnType<typeof rng>, evaDay: number | null): Reading[] {
  const b = m.baseline as Record<string, number>;
  const noise = (sd: number) => r.gauss(0, sd);
  const boneRate = r.uniform(...BONE_LOSS_PER_MONTH) / 30;
  const plasmaDrop = r.uniform(...PLASMA_DROP);
  const calfRate = CALF_LOSS_6_MONTHS / 180;
  let bone = 100, calf = 100, vitD = b.vit_d_ng_ml, cumDose = 0, sleepDebt = 0;
  const massLoss = r.uniform(...MASS_LOSS_FIRST_MONTH) / 100;
  const mine = events.filter((e) => applies(e, m.id));
  const rows: Reading[] = [];

  for (let day = 1; day <= DAYS; day++) {
    const marks: string[] = [];
    const plasma = (-plasmaDrop * Math.min(day, 2)) / 2 + noise(0.8);
    const exerciseMin = clamp(r.gauss(110, 20), 30, 150);
    const resistanceKg = clamp(r.gauss(m.sex === "M" ? 70 : 50, 6), 20, 100);
    let exerciseFactor = 1.25 - 0.5 * (exerciseMin / 150);

    // Hydration and sodium; a fluid drop lasts `length` days, or to the end
    let fluid = b.fluid_ml + noise(150);
    let sodium = b.sodium_mg + noise(500);
    const drop = mine.find((e) => e.type === "fluid_drop" && day >= e.day && (!e.length || day < e.day + e.length));
    if (drop) {
      fluid = b.fluid_ml * (1 - drop.strength / 100) + noise(100);
      sodium += 1000;
      exerciseFactor += 0.3;
      if (day === drop.day) marks.push("fluid_intake_drop");
    }
    const urineColor = clamp(Math.round(2 + (b.fluid_ml - fluid) / 350 + noise(0.4)), 1, 8);

    bone -= boneRate * exerciseFactor;
    let boneMarker = 100 + (100 - bone) * 18 + noise(4);
    if (drop) boneMarker += (day - drop.day + 1) * 2.5;
    calf -= calfRate * exerciseFactor;

    let sleep = clamp(r.gauss(SLEEP_ACTUAL_MEAN, 0.6), 4.0, 8.0);
    const night = mine.find((e) => e.type === "short_night" && e.day === day);
    if (night) { sleep = night.strength; marks.push("short_sleep_before_eva"); }
    const sleepMed = sleep < 5.2 && r.random() < 0.5;
    sleepDebt = Math.max(0, sleepDebt * 0.7 + (7.5 - sleep));

    let dose = Math.max(0.8, MARS_CRUISE_DOSE + noise(DOSE_SD));
    let inShelter = false;
    for (const s of mine.filter((e) => e.type === "solar_storm")) {
      const k = day - s.day;
      if (k >= 0 && k < (s.length ?? 1)) {
        dose += s.strength * STORM_TAIL ** k;
        inShelter = true;
        if (k === 0) marks.push("solar_storm");
      }
    }
    cumDose += dose;

    const lastNightShort = Math.max(0, 5.5 - sleep);
    const reaction = b.reaction_ms + sleepDebt * 9 + lastNightShort * 35 + (dose > 5 ? 15 : 0) + noise(8);
    const memory = clamp(Math.round(95 - sleepDebt * 2.5 - lastNightShort * 6 + noise(3)), 40, 100);
    const kcal = b.kcal_need * INTAKE_FRACTION + noise(120);
    const mass = b.body_mass_kg * (1 - massLoss * Math.min(1, day / 30)) + noise(0.25);
    vitD -= 0.08 + noise(0.02);

    const stress = clamp(Math.round(2 + sleepDebt / 4 + (inShelter ? 1 : 0) + noise(0.6)), 1, 5);
    const mood = clamp(Math.round(4 - sleepDebt / 5 - (stress >= 4 ? 0.5 : 0) + noise(0.5)), 1, 5);
    rows.push({
      crew_id: m.id,
      day,
      heart_rate: Math.round(b.heart_rate + 1 + (stress - 2) + noise(2.5)),
      bp_sys: Math.round(b.bp_sys + BP_SHIFT[0] * Math.min(1, day / 14) + noise(4)),
      bp_dia: Math.round(b.bp_dia + BP_SHIFT[1] * Math.min(1, day / 14) + noise(3)),
      temp_c: round(b.temp_c + TEMP_RISE * Math.min(1, day / 75) + noise(0.12), 1),
      spo2: Math.round(clamp(b.spo2 + noise(0.6), 94, 100)),
      glucose_mg_dl: Math.round(b.glucose_mg_dl + noise(6)),
      sleep_hours: round(sleep, 1),
      sleep_med_taken: sleepMed,
      sleep_debt_h: round(sleepDebt, 1),
      mood_1to5: mood,
      stress_1to5: stress,
      fluid_intake_ml: Math.round(fluid),
      urine_color_1to8: urineColor,
      sodium_mg: Math.round(sodium),
      plasma_volume_change_pct: round(plasma, 1),
      bone_density_pct: round(bone, 2),
      bone_resorption_index: round(boneMarker, 1),
      calf_volume_pct: round(calf, 2),
      exercise_min: Math.round(exerciseMin),
      resistance_load_kg: Math.round(resistanceKg),
      body_mass_kg: round(mass, 2),
      kcal_eaten: Math.round(kcal),
      vitamin_d_ng_ml: round(vitD, 1),
      radiation_mSv_today: round(dose, 2),
      radiation_mSv_total: round(cumDose, 1),
      in_storm_shelter: inShelter,
      reaction_time_ms: Math.round(reaction),
      memory_score: memory,
      eva_scheduled: day === evaDay,
      events: marks,
    } as Reading);
  }
  return rows;
}

/** Run the simulation for every crew member. The spacewalk day is the first short night's day (the readiness story). */
export function simulate(crew: CrewMember[], events: SimEvent[], seed = DEFAULT_SEED): SimData {
  const r = rng(seed);
  const evaDay = events.filter((e) => e.type === "short_night").map((e) => e.day).sort((a, b) => a - b)[0] ?? null;
  return {
    meta: {
      mission_profile: "mars_transit",
      days: DAYS,
      seed,
      simulated: true,
      custom: true,
      note: "Simulated in HALO from the crew baselines and events set in Settings. Rates from published NASA research; DEMO values are our own.",
      events,
    },
    crew,
    readings: crew.flatMap((m) => simulateMember(m, events, r, evaDay)),
  } as SimData;
}
