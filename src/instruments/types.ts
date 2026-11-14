/** One instrument reading. Same shape as src/shared/measurements.ts and the backend's Measurement contract. */
export type Measurement = {
  crewId: string;
  signal: string;
  value: number;
  unit: string;
  sourceId: string;
  provenance: "measured" | "self_reported" | "estimated" | "simulated";
  observedAt?: string;
  missionDay: number;
  quality: "valid" | "suspect" | "invalid";
};

/** Signals the instruments can fill, with the units from UNITS in backend/node/contracts.ts. */
export const INSTRUMENT_UNITS = {
  heart_rate: "bpm",
  bp_sys: "mmHg",
  bp_dia: "mmHg",
  temp_c: "degC",
  spo2: "%",
  sleep_hours: "h",
  body_mass_kg: "kg",
} as const;
export type InstrumentSignal = keyof typeof INSTRUMENT_UNITS;

/** Values outside these ranges are kept but marked "suspect" (a loose strap, a typo in a file). */
const PLAUSIBLE: Record<InstrumentSignal, [number, number]> = {
  heart_rate: [25, 230],
  bp_sys: [60, 250],
  bp_dia: [30, 150],
  temp_c: [33, 42],
  spo2: [70, 100],
  sleep_hours: [0, 16],
  body_mass_kg: [30, 200],
};
export function qualityOf(
  signal: InstrumentSignal,
  value: number,
): Measurement["quality"] {
  if (!Number.isFinite(value)) return "invalid";
  const [lo, hi] = PLAUSIBLE[signal];
  return value >= lo && value <= hi ? "valid" : "suspect";
}

/** Mission days the backend accepts. */
export const MIN_DAY = 1;
export const MAX_DAY = 120;

export const round = (v: number, digits = 1) =>
  Math.round(v * 10 ** digits) / 10 ** digits;
/** Daily values keep one decimal, sleep keeps two (7.25 h). */
export const roundFor = (signal: InstrumentSignal, v: number) =>
  round(v, signal === "sleep_hours" ? 2 : 1);
/** A calendar day "YYYY-MM-DD" as an ISO datetime the backend accepts (start of that day, UTC). */
export const dayStart = (dateKey: string) => `${dateKey}T00:00:00.000Z`;
/** Whole days from date key b to date key a. */
export const daysBetween = (a: string, b: string) =>
  Math.round((Date.parse(dayStart(a)) - Date.parse(dayStart(b))) / 86_400_000);
export const LB_TO_KG = 0.45359237;
export const fToC = (f: number) => ((f - 32) * 5) / 9;
