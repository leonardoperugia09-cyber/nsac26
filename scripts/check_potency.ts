// Checks the medicine potency tracker against its own calibration and the simulated crew's radiation.
// Run: node --experimental-strip-types scripts/check_potency.ts   (Node 22.6+, or: npx tsx scripts/check_potency.ts)

import { readFileSync } from "node:fs";
import { BETA, ISS_DOSE_PER_DAY, USP_LIMIT, forecastPotency, potencyStatus, strengthAt } from "../src/engine/potency.ts";
import { NORMAL_DOSE } from "../src/rules/solarStorm.ts";
import type { SimData } from "../src/engine/types.ts";

const data: SimData = JSON.parse(readFileSync(new URL("../data/crew_sim.json", import.meta.url), "utf8"));
const totalOn = (c: string, d: number) => data.readings.find((r) => r.crew_id === c && r.day === d)!.radiation_mSv_total;

let failures = 0;
const expect = (ok: boolean, msg: string) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${msg}`);
  if (!ok) failures++;
};
const close = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;
const SHELF = 1095; // a 3-year shelf life

// 1. Calibration: a pack kept on Earth reaches 90% exactly at its label date
expect(close(strengthAt(SHELF, SHELF, 0, BETA.mid), USP_LIMIT, 0.01), "Earth-stored pack is at 90% on its label date");

// 2. ISS calibration: best estimate ages medicine 1.5x faster in flight (NASA reanalysis of Du et al. 2011)
const issDays = SHELF / 1.5;
expect(close(strengthAt(SHELF, issDays, ISS_DOSE_PER_DAY * issDays, BETA.mid), USP_LIMIT, 0.01), "On the ISS a pack reaches 90% after 1/1.5 of its shelf life (best estimate)");
expect(close(strengthAt(SHELF, SHELF, ISS_DOSE_PER_DAY * SHELF, BETA.low), USP_LIMIT, 0.01), "Optimistic edge = no extra effect in flight (Wotring 2016)");

// 3. Shape: strength only falls, and the band always contains the best estimate
const f = forecastPotency({ shelfLifeDays: SHELF, day: 58, doseSoFar_mSv: 124, doseRate_mSv: NORMAL_DOSE.mars_transit });
expect(f.series.every((p, i) => i === 0 || p.mid <= f.series[i - 1].mid), "Strength never goes up over the mission");
expect(f.series.every((p) => p.low <= p.mid && p.mid <= p.high), "Range always contains the best estimate");
const b = f.below90;
expect((b.early ?? Infinity) <= (b.mid ?? Infinity) && (b.mid ?? Infinity) <= (b.late ?? Infinity), "Worst-case day <= best-estimate day <= best-case day");

// 4. Radiation matters: the same pack lasts longer on the ISS than in Mars cruise
const iss = forecastPotency({ shelfLifeDays: SHELF, day: 58, doseSoFar_mSv: 58 * NORMAL_DOSE.iss, doseRate_mSv: NORMAL_DOSE.iss });
const mars = forecastPotency({ shelfLifeDays: SHELF, day: 58, doseSoFar_mSv: 58 * NORMAL_DOSE.mars_transit, doseRate_mSv: NORMAL_DOSE.mars_transit });
expect((iss.below90.mid ?? 9999) > (mars.below90.mid ?? 9999), `Drops below 90% later on the ISS (day ${iss.below90.mid}) than in Mars cruise (day ${mars.below90.mid})`);

// 5. The planted day-40 solar storm shows up: it costs strength compared with a normal day
for (const c of data.crew.map((x) => x.id)) {
  const storm = totalOn(c, 41) - totalOn(c, 39);
  const withStorm = forecastPotency({ shelfLifeDays: SHELF, day: 41, doseSoFar_mSv: totalOn(c, 41), doseRate_mSv: NORMAL_DOSE.mars_transit });
  const noStorm = forecastPotency({ shelfLifeDays: SHELF, day: 41, doseSoFar_mSv: totalOn(c, 39) + 2 * NORMAL_DOSE.mars_transit, doseRate_mSv: NORMAL_DOSE.mars_transit });
  expect(storm > 10 && withStorm.now.mid < noStorm.now.mid && (withStorm.below90.mid ?? 0) <= (noStorm.below90.mid ?? 0),
    `${c}: the storm's ${storm.toFixed(1)} mSv lowers strength and brings the 90% day forward (day ${withStorm.below90.mid} vs ${noStorm.below90.mid})`);
}

// 6. Status labels
expect(potencyStatus(forecastPotency({ shelfLifeDays: 300, day: 58, doseSoFar_mSv: 124, doseRate_mSv: 1.8 }), 58) === "Below 90%", "A short-shelf-life pack late in its life reads Below 90%");
expect(potencyStatus(forecastPotency({ shelfLifeDays: 20 * 365, day: 58, doseSoFar_mSv: 124, doseRate_mSv: 1.8 }), 58) === "Fine", "A very stable pack reads Fine");

// Example for the demo: C2 on day 58, Mars transit
console.log("\nC2, day 58, Mars transit (3-year shelf life):");
const demo = forecastPotency({ shelfLifeDays: SHELF, day: 58, doseSoFar_mSv: totalOn("C2", 58), doseRate_mSv: NORMAL_DOSE.mars_transit });
console.log(`  strength now ${demo.now.mid.toFixed(1)}% (range ${demo.now.low.toFixed(1)}-${demo.now.high.toFixed(1)}%)`);
console.log(`  below 90% on day ${demo.below90.mid} (range day ${demo.below90.early} to ${demo.below90.late ?? "after day 900"})`);

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
