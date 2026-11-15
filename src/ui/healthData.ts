// Number formatting and trend data for the Health and Daily Log pages.
// Bands and out-of-band points come from the engine (src/engine/baseline.ts), built the same way as overviewData.ts.
import { bandCentreAt, computeBaselines } from "../engine/baseline.ts";
import { SIGNAL_BY_KEY } from "../engine/signals.ts";
import { historyOf } from "../data/crew.ts";

const DIGITS: Record<string, number> = {
  body_mass_kg: 1, vitamin_d_ng_ml: 1, sleep_hours: 1, sleep_debt_h: 1,
};

/** The number only, formatted for one signal. */
export function fmtNum(key: string, v: number): string {
  if (key === "fluid_intake_ml") return (v / 1000).toFixed(2);
  if (key === "sodium_mg") return Math.round(v).toLocaleString("en-US");
  if (key.endsWith("_pct")) return v.toFixed(1);
  if (key in DIGITS) return v.toFixed(DIGITS[key]);
  return String(Math.round(v));
}

/** The unit shown next to the number. */
export function fmtUnit(key: string): string {
  if (key === "fluid_intake_ml") return "L";
  if (key === "urine_color_1to8") return "of 8";
  if (key === "sodium_mg") return "mg";
  if (key.endsWith("_pct")) return "%";
  if (key === "sleep_hours" || key === "sleep_debt_h") return "h";
  return SIGNAL_BY_KEY[key]?.unit ?? "";
}

/** "2.55-3.16 L" (hyphen). */
export function fmtRange(key: string, lo: number, hi: number): string {
  const unit = fmtUnit(key);
  return `${fmtNum(key, lo)}-${fmtNum(key, hi)}${unit ? ` ${unit}` : ""}`;
}

export type TrendPoint = { day: number; value: number; band: [number, number]; out: number | null };
export type Trend = { points: TrendPoint[]; now: number; lo: number; hi: number; outNow: boolean };

/** Last 30 days of one signal with its personal band. An amber segment ends outside the band in the harmful direction. */
export function buildTrend(crewId: string, day: number, key: string): Trend {
  const history = historyOf(crewId);
  const b = computeBaselines(history)[key];
  const bad = SIGNAL_BY_KEY[key]?.badDirection ?? 0;
  const rows = history.filter((r) => r.day >= day - 29 && r.day <= day);
  const pts = rows.map((r) => {
    const value = r[key as keyof typeof r] as number;
    const c = bandCentreAt(b, r.day);
    const band: [number, number] = [c - 2 * b.sd, c + 2 * b.sd];
    const isOut = bad < 0 ? value < band[0] : bad > 0 ? value > band[1] : value < band[0] || value > band[1];
    return { day: r.day, value, band, isOut };
  });
  const points = pts.map((p, i) => ({
    day: p.day, value: p.value, band: p.band,
    out: p.isOut || pts[i + 1]?.isOut ? p.value : null,
  }));
  const last = pts[pts.length - 1];
  return { points, now: last.value, lo: last.band[0], hi: last.band[1], outNow: last.isOut };
}
