// Body-map view model. Pure: no React, no Vite imports, so scripts/check_bodymap.ts runs it under Node.
//
// The coupled risk engine (evaluateRisks) is the ONLY source of risk levels. This layer only:
//   - groups engine risks and drift scores by anatomical region (see regions.ts),
//   - handles missing / stale readings honestly (the engine reads a missing value as NaN,
//     which would otherwise look "inside band"),
//   - picks the worst status per region.
//
// Region status rules:
//   act      only when an engine risk linked to the region is at Act
//   watch    an engine risk at Watch, or a direct signal outside its personal band
//            (one signal far outside its band is still only Watch; the engine decides Act)
//   nominal  at least one fresh direct signal, all inside band, no linked risk at Watch or above
//   stale    no fresh direct signal, and at least one whose last value is older than STALE_AFTER_DAYS
//   unknown  no direct reading at all ("no direct reading")

import { computeBaselines, computeDrift, type Band, type Drift } from "../engine/baseline.ts";
import {assessCrew, type AssessedRisk} from "../engine/assessment.ts";
import { SIGNAL_BY_KEY } from "../engine/signals.ts";
import type { Level, MissionProfile, Reading } from "../engine/types.ts";
type RiskResult=AssessedRisk;
import { REGIONS, regionsForRisk, type RegionDef, type RegionId } from "./regions.ts";

export { regionsForRisk };

/** DEMO parameter: a reading older than this many days counts as stale. Not a clinical rule. */
export const STALE_AFTER_DAYS = 3;
/** DEMO: drift trend (standard deviations per week) that counts as "moving". */
const TREND_AT = 0.5;

export type RegionStatus = "nominal" | "watch" | "act" | "unknown" | "stale";
export type IndicatorStatus = "inside" | "outside" | "far" | "unknown" | "stale" | "no_baseline";
export type IndicatorRole = "signal" | "driver" | "raw";
export type Trend = "toward_baseline" | "away_from_baseline" | "steady";

export type Indicator = {
  key: string;
  label: string;
  unit: string;
  role: IndicatorRole;
  value: number | null; // latest finite value on or before the day (slow signals: engine 3-day mean)
  day: number | null; // mission day of that value
  band: [number, number] | null; // personal baseline band on this day
  trend: Trend | null;
  status: IndicatorStatus;
  note?: string;
};

export type RegionModel = {
  def: RegionDef;
  status: RegionStatus;
  indicators: Indicator[];
  risks: RiskResult[]; // engine risks linked to this region, worst first (all levels)
  outside: number; // direct signals outside their band
  scored: number; // direct signals with a fresh baseline comparison
  staleInputs: string[];
  unknownInputs: string[];
  ariaLabel: string;
};

export type BodyMapModel = {
  day: number;
  profile: MissionProfile;
  risks: RiskResult[]; // straight from evaluateRisks, worst first
  regions: Record<RegionId, RegionModel>;
  overall: RegionStatus;
};

const RANK: Record<RegionStatus, number> = { nominal: 0, unknown: 1, stale: 2, watch: 3, act: 4 };
export const worstStatus = (xs: RegionStatus[]): RegionStatus =>
  xs.reduce<RegionStatus>((w, x) => (RANK[x] > RANK[w] ? x : w), "nominal");

export const STATUS_TEXT: Record<RegionStatus, string> = {
  nominal: "Nominal",
  watch: "Watch",
  act: "Act",
  unknown: "No direct reading",
  stale: "Stale data",
};

const LEVEL_RANK = { Nominal: 0, Unknown: 0, Watch: 1, Act: 2 };

/** A field counts as measured only when it is a finite number (null / undefined / NaN = missing). */
const finite = (r: Reading, key: string): number | null => {
  const v = (r as Record<string, unknown>)[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
};

function lastFinite(upTo: Reading[], key: string): { value: number; day: number } | null {
  for (let i = upTo.length - 1; i >= 0; i--) {
    const v = finite(upTo[i], key);
    if (v !== null) return { value: v, day: upTo[i].day };
  }
  return null;
}

function indicator(key: string, role: IndicatorRole, upTo: Reading[], day: number, drift: Record<string, Drift>, bands: Record<string, Band>): Indicator {
  const def = SIGNAL_BY_KEY[key];
  const last = lastFinite(upTo, key);
  const base = {
    key,
    role,
    label: def?.label ?? key,
    unit: def?.unit ?? "",
    value: last?.value ?? null,
    day: last?.day ?? null,
    band: null,
    trend: null,
  };
  if (!last) return { ...base, status: "unknown", note: "No reading" };
  if (day - last.day > STALE_AFTER_DAYS) return { ...base, status: "stale", note: `Last reading day ${last.day}` };
  // Guard: a field with no SignalDef (e.g. resistance_load_kg) has no personal baseline
  if (role === "raw" || !def || !bands[key]) return { ...base, role: "raw", status: "no_baseline", note: "No baseline" };
  const d = drift[key];
  if (!d || !Number.isFinite(d.value) || !Number.isFinite(d.score)) {
    return { ...base, status: "unknown", note: "Gap in recent data: not compared with baseline" };
  }
  const trend: Trend = d.howFast >= TREND_AT ? "away_from_baseline" : d.howFast <= -TREND_AT ? "toward_baseline" : "steady";
  const status: IndicatorStatus = d.status === "far outside" ? "far" : d.status === "outside band" ? "outside" : "inside";
  return { ...base, value: d.value, band: [d.bandLo, d.bandHi], trend, status };
}

function ariaLabel(def: RegionDef, status: RegionStatus, outside: number, scored: number): string {
  const parts = [`${def.name}: ${STATUS_TEXT[status]}`];
  if (def.signalIds.length === 0) parts.push("not directly monitored");
  else parts.push(`${outside} of ${scored} indicators outside personal baseline`);
  return parts.join(", ");
}

function regionModel(def: RegionDef, upTo: Reading[], day: number, drift: Record<string, Drift>, bands: Record<string, Band>, risks: RiskResult[]): RegionModel {
  const indicators = [
    ...def.signalIds.map((k) => indicator(k, "signal", upTo, day, drift, bands)),
    ...def.driverIds.map((k) => indicator(k, "driver", upTo, day, drift, bands)),
    ...def.rawSignalIds.map((k) => indicator(k, "raw", upTo, day, drift, bands)),
  ];
  const linked = risks
    .filter((r) => def.riskIds.includes(r.ruleId))
    .sort((a, b) => LEVEL_RANK[b.level] - LEVEL_RANK[a.level] || (b.score??0) - (a.score??0));

  const direct = indicators.filter((i) => i.role === "signal");
  const scoredInd = direct.filter((i) => i.status === "inside" || i.status === "outside" || i.status === "far");
  const outside = scoredInd.filter((i) => i.status !== "inside").length;
  const staleInputs = indicators.filter((i) => i.status === "stale").map((i) => i.label);
  const unknownInputs = indicators.filter((i) => i.status === "unknown").map((i) => i.label);

  let status: RegionStatus;
  if (linked.some((r) => r.level === "Act")) status = "act";
  else if (linked.some((r) => r.level === "Watch") || outside > 0) status = "watch";
  else if (scoredInd.length > 0) status = "nominal";
  else if (direct.some((i) => i.status === "stale")) status = "stale";
  else status = "unknown";

  return {
    def,
    status,
    indicators,
    risks: linked,
    outside,
    scored: scoredInd.length,
    staleInputs,
    unknownInputs,
    ariaLabel: ariaLabel(def, status, outside, scoredInd.length),
  };
}

/** Everything the body map shows for one astronaut (their own `history`) on one mission day. */
export function buildBodyMapModel(history: Reading[], day: number, profile: MissionProfile = "mars_transit", context:Record<string,unknown>={}): BodyMapModel {
  const upTo = history.filter((r) => r.day <= day).sort((a, b) => a.day - b.day);
  const risks = assessCrew(history,day,profile,context).risks;
  const bands = computeBaselines(upTo,day);
  const drift = computeDrift(history, bands, day);
  const regions = Object.fromEntries(
    REGIONS.map((def) => [def.id, regionModel(def, upTo, day, drift, bands, risks)]),
  ) as Record<RegionId, RegionModel>;
  const statuses = Object.values(regions).map((r) => r.status);
  // Overall: Act / Watch if any region has it; otherwise nominal (unknown regions don't make the crew "unknown")
  const overall: RegionStatus = statuses.includes("act") ? "act" : statuses.includes("watch") ? "watch" : "nominal";
  return { day, profile, risks, regions, overall };
}
