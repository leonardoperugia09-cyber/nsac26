// Personal baseline bands + drift scoring.
//
// 1. BASELINE BAND — each astronaut's own "normal" for each signal.
//    DEMO adaptation reference from days 7-20 in flight (not measured pre-flight normal) (after the first-week fluid shift and sleep adjustment
//    settle). Band = their average ± 2 × their normal spread (standard deviation).
//    For bone, muscle, body mass and vitamin D the band slides along the published in-flight rate,
//    because those decline for everyone (see signals.ts).
//
// 2. DRIFT — every day, for every signal:
//    - HOW FAR: how many standard deviations today sits from the centre of the band,
//      counted only in the BAD direction (e.g. less sleep, more radiation). 2 = at the band's edge.
//    - HOW FAST: the 7-day trend, in standard deviations per week, again only in the bad direction.
//      This catches a signal sliding steadily toward the edge before it crosses it.
//    - SCORE: how far + a quarter of how fast (only when it's moving the wrong way).
//    - STATUS: inside band (score < 2) / outside band (2-3) / far outside (3+). DEMO thresholds.
//
// Uses only data up to the day being scored, so it works live — no peeking at the future.

import type { Reading } from "./types.ts";
import { SIGNALS, SIGNAL_BY_KEY } from "./signals.ts";

export const BASELINE_WINDOW = { from: 7, to: 20 }; // mission days used to learn each person's normal
const TREND_DAYS = 7;
const SPEED_WEIGHT = 0.25; // DEMO
export const OUTSIDE_AT = 2; // DEMO: score where a signal leaves its band
export const FAR_OUTSIDE_AT = 3; // DEMO

// Signals that change sharply day to day are judged on today's value;
// slow ones on a 3-day average so one noisy reading doesn't trigger anything.
const FAST_SIGNALS = new Set([
  "radiation_mSv_today",
  "sleep_hours",
  "reaction_time_ms",
  "memory_score",
]);

export type Band = {
  mean: number; // centre of the band on centerDay
  sd: number; // the person's normal spread
  lo: number; // band bottom on centerDay (mean - 2 sd)
  hi: number; // band top on centerDay (mean + 2 sd)
  nDays: number; // days of data the band was learned from
  centerDay: number;
  expectedPerDay: number; // how much the band slides per day (0 for most signals)
  throughDay: number;
};

export type DriftStatus = "inside band" | "outside band" | "far outside";

export type Drift = {
  signal: string;
  label: string;
  value: number; // what was measured (today, or 3-day average for slow signals)
  bandLo: number; // the person's band on this day
  bandHi: number;
  howFar: number; // standard deviations from the band centre, toward the bad direction
  howFast: number; // standard deviations per week, toward the bad direction
  score: number;
  status: DriftStatus;
};

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const sd = (xs: number[]) => {
  const m = mean(xs);
  return Math.sqrt(
    xs.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, xs.length - 1),
  );
};
const get = (r: Reading, key: string) => {
  const v = (r as Record<string, unknown>)[key];
  return typeof v === "number" && Number.isFinite(v) ? v : NaN;
};
function validateHistory(history: Reading[]) {
  if (new Set(history.map((r) => r.crew_id)).size > 1)
    throw new Error("Mixed crew history");
  if (new Set(history.map((r) => r.day)).size !== history.length)
    throw new Error("Duplicate mission day");
  if (history.some((r) => !Number.isInteger(r.day) || r.day < 1))
    throw new Error("Invalid mission day");
}

/** Least-squares slope, per step. */
function slope(ys: number[], days: number[]): number {
  const n = ys.length;
  if (n < 3) return 0;
  const xm = mean(days);
  const ym = mean(ys);
  let num = 0;
  let den = 0;
  ys.forEach((y, i) => {
    num += (days[i] - xm) * (y - ym);
    den += (days[i] - xm) ** 2;
  });
  return den === 0 ? 0 : num / den;
}

/** Where the centre of this person's band is on a given day. */
export const bandCentreAt = (b: Band, day: number) =>
  b.mean + b.expectedPerDay * (day - b.centerDay);

/** Learn one astronaut's baseline band for every signal. Pass that astronaut's readings only. */
export function computeBaselines(
  history: Reading[],
  asOfDay = Infinity,
): Record<string, Band> {
  validateHistory(history);
  const win = history.filter(
    (r) =>
      r.day >= BASELINE_WINDOW.from &&
      r.day <= BASELINE_WINDOW.to &&
      r.day <= asOfDay,
  );
  const bands: Record<string, Band> = {};
  for (const s of SIGNALS) {
    const pts = win
      .map((r) => ({ day: r.day, x: get(r, s.key) }))
      .filter((p) => Number.isFinite(p.x));
    if (pts.length < 7) continue;
    const centerDay = mean(pts.map((p) => p.day));
    const raw = mean(pts.map((p) => p.x));
    const perDay = s.expectedPerDay ?? ((s.expectedPctPerDay ?? 0) / 100) * raw;
    // Take out the expected in-flight change before measuring the person's normal spread
    const resid = pts.map((p) => p.x - perDay * (p.day - centerDay));
    const m = mean(resid);
    const d = Math.max(sd(resid), s.minSd);
    bands[s.key] = {
      mean: m,
      sd: d,
      lo: m - 2 * d,
      hi: m + 2 * d,
      nDays: pts.length,
      centerDay,
      expectedPerDay: perDay,
      throughDay: Math.max(...pts.map((p) => p.day)),
    };
  }
  return bands;
}

/** Score every signal for one astronaut on one mission day, using only data up to that day. */
export function computeDrift(
  history: Reading[],
  bands: Record<string, Band>,
  day: number,
): Record<string, Drift> {
  validateHistory(history);
  if (
    Object.values(bands).some(
      (b) => !Number.isFinite(b.throughDay) || b.throughDay > day,
    )
  )
    bands = computeBaselines(history, day);
  const upTo = history
    .filter((r) => r.day <= day)
    .sort((a, b) => a.day - b.day);
  const out: Record<string, Drift> = {};
  if (upTo.length === 0 || upTo.at(-1)!.day !== day) return out;
  const today = upTo[upTo.length - 1];
  const last3 = upTo.filter((r) => r.day >= day - 2);
  const lastWeek = upTo.filter((r) => r.day >= day - TREND_DAYS + 1);

  for (const [key, band] of Object.entries(bands)) {
    const def = SIGNAL_BY_KEY[key];
    if (
      !def ||
      !Number.isFinite(get(today, key)) ||
      last3.some((r) => !Number.isFinite(get(r, key))) ||
      lastWeek.some((r) => !Number.isFinite(get(r, key)))
    )
      continue;
    const fast = FAST_SIGNALS.has(key);
    const value = fast ? get(today, key) : mean(last3.map((r) => get(r, key)));
    const at = fast ? today.day : mean(last3.map((r) => r.day));
    const centre = bandCentreAt(band, at);

    const rawFar = (value - centre) / band.sd;
    const rawFast =
      def?.trend === false || lastWeek.length < 3
        ? 0
        : ((slope(
            lastWeek.map((r) => get(r, key)),
            lastWeek.map((r) => r.day),
          ) -
            band.expectedPerDay) *
            TREND_DAYS) /
          band.sd;
    const dir = def.badDirection;
    const howFar = dir === 0 ? Math.abs(rawFar) : dir * rawFar;
    const howFast = dir === 0 ? Math.abs(rawFast) : dir * rawFast;
    const score = Math.max(
      howFar,
      howFar + SPEED_WEIGHT * Math.max(0, howFast),
    );

    out[key] = {
      signal: key,
      label: def.label,
      value,
      bandLo: centre - 2 * band.sd,
      bandHi: centre + 2 * band.sd,
      howFar,
      howFast,
      score,
      status:
        score >= FAR_OUTSIDE_AT
          ? "far outside"
          : score >= OUTSIDE_AT
            ? "outside band"
            : "inside band",
    };
  }
  return out;
}
