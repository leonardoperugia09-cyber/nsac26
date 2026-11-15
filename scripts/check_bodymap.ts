import {computeBaselines} from "../src/engine/baseline.ts";
// Checks the body-map model (src/bodymap) against the engine and the planted events.
// Run: npm run check:bodymap   (= node --experimental-strip-types scripts/check_bodymap.ts, Node 22.6+)

import { readFileSync } from "node:fs";
import { buildBodyMapModel, regionsForRisk, type BodyMapModel } from "../src/bodymap/model.ts";
import { REGIONS } from "../src/bodymap/regions.ts";
import { SIGNAL_BY_KEY } from "../src/engine/signals.ts";
import { computeBaselines, computeDrift } from "../src/engine/baseline.ts";
import { COUPLING_RULES } from "../src/rules/index.ts";
import type { Reading, SimData } from "../src/engine/types.ts";

const data: SimData = JSON.parse(readFileSync(new URL("../data/crew_sim.json", import.meta.url), "utf8"));
const historyOf = (c: string): Reading[] => data.readings.filter((r) => r.crew_id === c).map((r) => ({ ...r }));
const model = (c: string, d: number, h = historyOf(c)) => buildBodyMapModel(h, d, "mars_transit");

let failures = 0;
const expect = (ok: boolean, msg: string) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${msg}`);
  if (!ok) failures++;
};
const st = (m: BodyMapModel, id: keyof BodyMapModel["regions"]) => m.regions[id].status;

// Config integrity: every id the map uses exists in the engine
const ruleIds = new Set(COUPLING_RULES.map((r) => r.id));
const sample = data.readings[0] as Record<string, unknown>;
for (const r of REGIONS) {
  for (const k of [...r.signalIds, ...r.driverIds]) expect(k in SIGNAL_BY_KEY, `${r.id}: signal ${k} has a SignalDef`);
  for (const k of r.rawSignalIds) expect(k in sample && !(k in SIGNAL_BY_KEY), `${r.id}: raw field ${k} exists in the data and has no SignalDef`);
  for (const k of r.riskIds) expect(ruleIds.has(k), `${r.id}: risk ${k} exists in COUPLING_RULES`);
}

// Planted event 2: C2 fluid drop from day 55
const c2d50 = model("C2", 50);
expect(st(c2d50, "kidneys") !== "act", `C2 day 50: kidneys not act (got ${st(c2d50, "kidneys")})`);
const c2d58 = model("C2", 58);
const kid = c2d58.regions.kidneys;
const ks = kid.risks.find((r) => r.ruleId === "kidney_stone");
expect(kid.status === "act", `C2 day 58: kidneys act (got ${kid.status})`);
expect(!!ks && ks.level === "Act" && ks.why.length > 0 && ks.action.length > 0, "C2 day 58: kidney stone risk carries mechanism (why) and action");
expect(st(c2d58, "skeleton") === "act", `C2 day 58: skeleton shares the kidney stone Act (got ${st(c2d58, "skeleton")})`);
expect(c2d58.overall === "act", "C2 day 58: overall status act");

// Musculoskeletal Watch (C2 skips workouts later in the mission)
const mskDay = Array.from({ length: 100 }, (_, i) => 21 + i).find(
  (d) => model("C2", d).risks.find((r) => r.ruleId === "musculoskeletal")?.level === "Watch",
);
expect(mskDay !== undefined, `C2: musculoskeletal reaches Watch (first on day ${mskDay})`);
if (mskDay !== undefined) expect(st(model("C2", mskDay), "muscles") === "watch", `C2 day ${mskDay}: muscles watch`);

// Planted event 1: solar storm day 40
const c1d40 = model("C1", 40);
expect(["watch", "act"].includes(st(c1d40, "whole_body")), `C1 day 40: whole_body watch/act from the solar storm (got ${st(c1d40, "whole_body")})`);
expect(c1d40.regions.whole_body.risks.some((r) => r.ruleId === "solar_storm" && r.level !== "Nominal"), "C1 day 40: solar storm risk linked to whole_body");

// Missing data: spo2 deleted everywhere -> lungs unknown (not nominal)
const noSpo2 = historyOf("C1").map((r) => {
  const x = { ...r } as Partial<Reading>;
  delete x.spo2;
  return x as Reading;
});
expect(st(model("C1", 30, noSpo2), "lungs") === "unknown", `Synthetic, no spo2: lungs unknown (got ${st(model("C1", 30, noSpo2), "lungs")})`);

// Stale data: last 5 days of fluid fields removed -> kidneys stale
const FLUID = ["fluid_intake_ml", "urine_color_1to8", "sodium_mg"] as const;
const staleH = historyOf("C1").map((r) => {
  if (r.day <= 25) return r;
  const x = { ...r } as Partial<Reading>;
  for (const k of FLUID) delete x[k];
  return x as Reading;
});
const staleM = model("C1", 30, staleH);
expect(staleM.regions.kidneys.status === "stale", `Synthetic, fluid fields missing days 26-30: kidneys stale (got ${staleM.regions.kidneys.status})`);
expect(staleM.regions.kidneys.staleInputs.length === 3, "Synthetic stale: all 3 kidney inputs listed as stale");

// Guard: field without SignalDef shows raw value, "no baseline"
const load = model("C1", 30).regions.muscles.indicators.find((i) => i.key === "resistance_load_kg");
expect(!!load && load.status === "no_baseline" && load.value !== null, "resistance_load_kg: raw value, status no baseline");

// Regions with no direct signal are never nominal
expect(st(model("C1", 30), "eyes") === "unknown", "C1 day 30: eyes unknown (no direct reading), not nominal");

// Coupled risk -> regions
const kr = regionsForRisk("kidney_stone");
expect(kr.includes("kidneys") && kr.includes("skeleton"), `regionsForRisk(kidney_stone) = ${kr.join(", ")}`);

// Nominal case: on a calm day (every signal inside its personal band, every engine risk Nominal)
// the map must read nominal. The calm day is found from the data rather than hard-coded, because
// regenerating the simulator moves the random short nights (C1 day 30 is no longer calm).
const c1h = historyOf("C1");
const c1bands = computeBaselines(c1h);
const calmDay = Array.from({ length: 100 }, (_, i) => 21 + i).find((d) => {
  const drift = computeDrift(c1h, c1bands, d);
  return Object.values(drift).every((x) => x.status === "inside band") && model("C1", d).risks.every((r) => r.level === "Nominal" || r.level === "Unknown"); // Unknown = inputs missing, not a raised risk
});
expect(calmDay !== undefined, `C1 has a calm day after the baseline window (first on day ${calmDay})`);
if (calmDay !== undefined) {
  const calm = model("C1", calmDay);
  expect(st(calm, "kidneys") === "nominal" && st(calm, "heart") === "nominal", `C1 day ${calmDay}: kidneys and heart nominal`);
  expect(calm.overall === "nominal", `C1 day ${calmDay}: overall nominal (got ${calm.overall})`);
}

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
