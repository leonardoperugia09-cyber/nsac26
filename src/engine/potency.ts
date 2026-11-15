// Medicine potency tracker: how strong each onboard medicine still is, and when it will drop below 90%.
//
//   import { forecastPotency } from "../engine/potency.ts";
//   const f = forecastPotency({ shelfLifeDays: 1095, day: 58, doseSoFar_mSv: 124, doseRate_mSv: 1.8 });
//   f.now.mid        // % of label strength today (best estimate)
//   f.below90.mid    // mission day it is expected to drop below 90%, or null if it lasts the horizon
//   f.series         // [{ day, mid, low, high }] for a chart with an uncertainty band
//
// Model (first-order breakdown, the shape NASA's reanalysis of Du et al. 2011 found):
//   strength = 100 * exp(-(timeTerm + spaceTerm))
//   timeTerm  = kGround * total days since manufacture
//   spaceTerm = kGround * beta * (dose absorbed in flight / ISS dose per day)
// kGround comes from the label shelf life: we assume the label date is where a ground-stored pack reaches 90%,
// which is cautious (Wotring 2016: 5 of 9 ISS-returned medicines still passed 5-8 months after their label date).
// The space term is scaled by radiation dose, so a 1.8 mSv/day Mars cruise ages medicine faster than the ISS.
//
// beta (how much faster spaceflight makes it), calibrated on the ISS:
//   0.5 = best estimate. NASA's reanalysis of Du et al. 2011 found about 1.5x faster breakdown in flight.
//   0   = optimistic edge. Wotring 2016 saw no unusual breakdown after 550 days on the ISS.
//   1.0 = pessimistic edge, twice as fast.
// Scaling the ISS result by dose beyond low Earth orbit is OUR ASSUMPTION: nobody has measured it
// (Blue et al. 2019, "Limitations in predicting radiation-induced pharmaceutical instability").
// Every number here is a DEMO estimate, not a lab measurement. HALO shows a range, never a single verdict.

export const ISS_DOSE_PER_DAY = 0.55; // mSv/day, ~100 mSv per 6 months on the ISS
export const BETA = { low: 0, mid: 0.5, high: 1.0 } as const;
export const USP_LIMIT = 90; // most medicines must keep 90-110% of label strength (USP)
export const AGE_AT_LAUNCH_DAYS = 180; // DEMO: packs made about 6 months before launch

export type PotencyInput = {
  /** Label shelf life from manufacture, in days */
  shelfLifeDays: number;
  /** Mission day to forecast from (day 1 = launch) */
  day: number;
  /** Radiation absorbed in flight so far (mSv), e.g. radiation_mSv_total from the crew data */
  doseSoFar_mSv: number;
  /** Expected dose per day from here on (mSv/day), e.g. NORMAL_DOSE[profile] */
  doseRate_mSv: number;
  /** Last mission day to forecast to */
  horizonDay?: number;
  ageAtLaunchDays?: number;
  limit?: number;
};

export type Band = { low: number; mid: number; high: number };
export type PotencyPoint = { day: number } & Band;
export type PotencyForecast = {
  /** % of label strength today. low = pessimistic edge, high = optimistic edge */
  now: Band;
  /** Mission day it drops below the limit. early = pessimistic, late = optimistic; null = lasts the horizon */
  below90: { early: number | null; mid: number | null; late: number | null };
  series: PotencyPoint[];
};

const kGround = (shelfLifeDays: number, limit: number) => Math.log(100 / limit) / shelfLifeDays;

/** % of label strength for one value of beta. Days and dose are totals at that moment. */
export function strengthAt(shelfLifeDays: number, ageDays: number, dose_mSv: number, beta: number, limit = USP_LIMIT) {
  const k = kGround(shelfLifeDays, limit);
  const spaceDays = beta * (dose_mSv / ISS_DOSE_PER_DAY);
  return 100 * Math.exp(-k * (ageDays + spaceDays));
}

export function forecastPotency(inp: PotencyInput): PotencyForecast {
  const { shelfLifeDays, day, doseSoFar_mSv, doseRate_mSv } = inp;
  const horizon = inp.horizonDay ?? 900;
  const age0 = inp.ageAtLaunchDays ?? AGE_AT_LAUNCH_DAYS;
  const limit = inp.limit ?? USP_LIMIT;

  const at = (d: number, beta: number) =>
    strengthAt(shelfLifeDays, age0 + d, doseSoFar_mSv + doseRate_mSv * (d - day), beta, limit);
  const band = (d: number): Band => ({ low: at(d, BETA.high), mid: at(d, BETA.mid), high: at(d, BETA.low) });

  // Strength only falls, so the first day below the limit can be found by bisection
  const firstBelow = (beta: number): number | null => {
    if (at(day, beta) < limit) return day;
    if (at(horizon, beta) >= limit) return null;
    let lo = day, hi = horizon;
    while (hi - lo > 1) {
      const m = Math.floor((lo + hi) / 2);
      if (at(m, beta) < limit) hi = m; else lo = m;
    }
    return hi;
  };

  const series: PotencyPoint[] = [];
  const step = Math.max(1, Math.round((horizon - day) / 80));
  for (let d = day; d < horizon; d += step) series.push({ day: d, ...band(d) });
  series.push({ day: horizon, ...band(horizon) });

  return {
    now: band(day),
    below90: { early: firstBelow(BETA.high), mid: firstBelow(BETA.mid), late: firstBelow(BETA.low) },
    series,
  };
}

/**
 * Plain-language status for a forecast. Thresholds are DEMO.
 *   Below 90%  best estimate is already under the limit
 *   Use first  best estimate drops below 90% within `soonDays` (about 4 months)
 *   Watch      best estimate drops below 90% within a year, or the worst case does within `soonDays`
 */
export type PotencyStatus = "Below 90%" | "Use first" | "Watch" | "Fine";
export function potencyStatus(f: PotencyForecast, day: number, soonDays = 120, watchDays = 365): PotencyStatus {
  if (f.now.mid < USP_LIMIT) return "Below 90%";
  if (f.below90.mid !== null && f.below90.mid - day <= soonDays) return "Use first";
  if ((f.below90.mid !== null && f.below90.mid - day <= watchDays) || (f.below90.early !== null && f.below90.early - day <= soonDays)) return "Watch";
  return "Fine";
}
