// Checks the in-browser simulator (src/sim/simulator.ts): the default events must tell the same story as the
// bundled data, and editing the events must change what the engine sees.
// Run: npx tsx scripts/check_sim.ts
import { readFileSync } from "node:fs";
import { DEFAULT_EVENTS, simulate } from "../src/sim/simulator.ts";
import { assessCrew } from "../src/engine/assessment.ts";
import { evaluateRisks } from "../src/engine/risks.ts";
import type { SimData } from "../src/engine/types.ts";

const bundled: SimData = JSON.parse(readFileSync(new URL("../data/crew_sim.json", import.meta.url), "utf8"));
let failures = 0;
const expect = (ok: boolean, msg: string) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${msg}`);
  if (!ok) failures++;
};
const history = (d: SimData, c: string) => d.readings.filter((r) => r.crew_id === c);
const row = (d: SimData, c: string, day: number) => d.readings.find((r) => r.crew_id === c && r.day === day)!;
const kidney = (d: SimData, c: string, day: number) => evaluateRisks(history(d, c), day).find((r) => r.ruleId === "kidney_stone")!.level;

const sim = simulate(bundled.crew, DEFAULT_EVENTS);
expect(sim.readings.length === 360, `360 daily rows (got ${sim.readings.length})`);
expect(sim.meta.simulated === true, "meta.simulated stays true (server validation)");
expect(JSON.stringify(simulate(bundled.crew, DEFAULT_EVENTS)) === JSON.stringify(sim), "same seed gives the same data");
expect(row(sim, "C2", 55).events.includes("fluid_intake_drop"), "C2 day 55 carries the fluid drop event");
expect(row(sim, "C1", 40).events.includes("solar_storm") && row(sim, "C1", 40).radiation_mSv_today > 10, "day 40 solar storm for everyone");
expect(row(sim, "C3", 70).sleep_hours === 3.4 && row(sim, "C3", 70).eva_scheduled, "C3 sleeps 3.4 h on spacewalk day 70");
expect(kidney(sim, "C2", 58) === "Act", `C2 kidney stone risk at Act on day 58 (got ${kidney(sim, "C2", 58)})`);
expect(assessCrew(history(sim, "C2"), 58).priority?.ruleId === "kidney_stone", "C2 day 58 priority is the kidney stone risk");
expect(kidney(sim, "C1", 58) !== "Act" && kidney(sim, "C3", 58) !== "Act", "no kidney stone Act for C1 or C3");

// Same order of magnitude as the bundled data (not bit-identical: different random generator)
const mean = (d: SimData, c: string, k: string, from: number, to: number) => {
  const v = d.readings.filter((r) => r.crew_id === c && r.day >= from && r.day <= to).map((r) => (r as any)[k] as number);
  return v.reduce((a, b) => a + b, 0) / v.length;
};
for (const k of ["heart_rate", "fluid_intake_ml", "sleep_hours", "radiation_mSv_total"]) {
  const a = mean(sim, "C2", k, 21, 50), b = mean(bundled, "C2", k, 21, 50);
  expect(Math.abs(a - b) / b < 0.12, `C2 ${k} days 21-50 close to bundled (${a.toFixed(1)} vs ${b.toFixed(1)})`);
}

// Editing changes the story
const calm = simulate(bundled.crew, DEFAULT_EVENTS.filter((e) => e.type !== "fluid_drop"));
expect(kidney(calm, "C2", 58) !== "Act", `without the fluid drop, no kidney stone Act for C2 (got ${kidney(calm, "C2", 58)})`);
const lena = simulate(bundled.crew, [...DEFAULT_EVENTS, { id: "x", type: "fluid_drop", crewId: "C3", day: 30, strength: 50 }]);
expect(kidney(lena, "C3", 40) === "Act" || kidney(lena, "C3", 40) === "Watch", `a fluid drop for Lena from day 30 raises her kidney risk by day 40 (got ${kidney(lena, "C3", 40)})`);
const edited = simulate(bundled.crew.map((m) => (m.id === "C1" ? { ...m, name: "Commander Ana Lima", baseline: { ...m.baseline, heart_rate: 70 } } : m)), DEFAULT_EVENTS);
expect(Math.abs(mean(edited, "C1", "heart_rate", 21, 50) - 71.5) < 3, "a new resting heart rate baseline shows in the readings");

console.log(failures ? `\n${failures} CHECK(S) FAILED` : "\nALL CHECKS PASSED");
process.exit(failures ? 1 : 0);
