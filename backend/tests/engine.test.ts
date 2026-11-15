import test from "node:test";
import assert from "node:assert/strict";
import { loadDataset } from "../node/data.ts";
import { assessCrew, readiness } from "../../src/engine/assessment.ts";
import { computeBaselines, computeDrift } from "../../src/engine/baseline.ts";
const { data } = loadDataset();
const h = (id: string) =>
  structuredClone(data.readings.filter((r) => r.crew_id === id));
const risk = (id: string, day: number, key: string) =>
  assessCrew(h(id), day).risks.find((r) => r.ruleId === key)!;
test("known renal event changes from nominal to persistent Act", () => {
  assert.equal(risk("C2", 50, "kidney_stone").level, "Nominal");
  const r = risk("C2", 60, "kidney_stone");
  assert.equal(r.level, "Act");
  assert.equal(r.persistence.observed, 2);
  assert.ok(r.contributors.length >= 2);
  assert.ok(r.evidenceIds.includes("kidney_2024"));
  assert.equal(r.range, null);
});
test("acute solar storm has one-day logic and source mission preserved", () => {
  for (const id of ["C1", "C2", "C3"])
    assert.equal(risk(id, 40, "solar_storm").level, "Act");
  assert.equal(risk("C1", 39, "solar_storm").level, "Nominal");
  assert.equal(
    assessCrew(h("C1"), 39, "iss").risks.find(
      (r) => r.ruleId === "solar_storm",
    )!.level,
    "Nominal",
  );
});
test("acute multi-signal cognition before scheduled EVA triggers and blocks demo readiness", () => {
  assert.equal(risk("C3", 70, "cognitive_readiness").level, "Act");
  assert.equal(readiness(h("C3"), 70).status, "No-go");
});
test("musculoskeletal decline is evaluated with persistence", () => {
  const rows = Array.from({ length: 40 }, (_, i) =>
    risk("C2", 81 + i, "musculoskeletal"),
  );
  assert.ok(rows.some((r) => r.level === "Watch" || r.level === "Act"));
});
test("missing measurements cannot be healthy", () => {
  const history = h("C2");
  (history.find((r) => r.day === 60)! as any).fluid_intake_ml = null;
  const a = assessCrew(history, 60);
  assert.equal(
    a.risks.find((r) => r.ruleId === "kidney_stone")!.level,
    "Unknown",
  );
  assert.equal(a.drift.fluid_intake_ml, undefined);
});
test("stale requested day and insufficient baseline return Unknown", () => {
  assert.ok(
    assessCrew(
      h("C1").filter((r) => r.day < 60),
      60,
    ).risks.every((r) => r.level === "Unknown"),
  );
  assert.equal(readiness(h("C1"), 1).status, "Insufficient data");
});
test("future records cannot change an earlier result", () => {
  const history = h("C2");
  assert.deepEqual(
    assessCrew(history, 15),
    assessCrew(
      history.filter((r) => r.day <= 15),
      15,
    ),
  );
  history
    .filter((r) => r.day > 15)
    .forEach((r) => {
      r.fluid_intake_ml = 0;
    });
  assert.deepEqual(
    assessCrew(history, 15),
    assessCrew(
      h("C2").filter((r) => r.day <= 15),
      15,
    ),
  );
});
test("one spurious coupled sample does not satisfy two-day persistence", () => {
  const history = h("C1");
  const r = history.find((r) => r.day === 50)!;
  r.fluid_intake_ml = 100;
  r.urine_color_1to8 = 8;
  r.sodium_mg = 15000;
  r.bone_resorption_index = 500;
  assert.equal(
    assessCrew(history, 50).risks.find((r) => r.ruleId === "kidney_stone")!
      .level,
    "Nominal",
  );
  assert.equal(
    assessCrew(history, 51).risks.find((r) => r.ruleId === "kidney_stone")!
      .level,
    "Nominal",
  );
});
test("astronauts are isolated and mixed histories rejected", () => {
  assert.equal(risk("C1", 60, "kidney_stone").level, "Nominal");
  assert.throws(() => assessCrew(data.readings, 60), /Mixed crew/);
});
test("NaN, missing and null never become inside band", () => {
  for (const value of [null, undefined, NaN, Infinity]) {
    const history = h("C2");
    (history.find((r) => r.day === 60)! as any).heart_rate = value;
    assert.equal(
      computeDrift(history, computeBaselines(history), 60).heart_rate,
      undefined,
    );
  }
});
test("symptom-based hypotheses disclose missing inputs", () => {
  assert.equal(risk("C1", 60, "fluid_shift").level, "Unknown");
  assert.equal(risk("C1", 60, "immune_strain").level, "Unknown");
});

for (const [ruleId, changes, context] of [
  [
    "fluid_shift",
    { heart_rate: 120, bp_sys: 70, bp_dia: 30 },
    { symptoms: ["headache"], vision_score: 2 },
  ],
  [
    "immune_strain",
    { sleep_debt_h: 30, stress_1to5: 5, mood_1to5: 1 },
    { symptoms: ["cold_sore"] },
  ],
  [
    "under_fuelling",
    { kcal_eaten: 500, body_mass_kg: 40, vitamin_d_ng_ml: 5 },
    {},
  ],
] as const) {
  test(`${ruleId}: persistent linked inputs trigger and baseline-matched values do not`, () => {
    const history = h("C1");
    for (const row of history.filter((r) => r.day === 59 || r.day === 60))
      Object.assign(row, changes);
    const triggered = assessCrew(
      history,
      60,
      "mars_transit",
      context,
    ).risks.find((r) => r.ruleId === ruleId)!;
    assert.ok(["Watch", "Act"].includes(triggered.level));
    assert.ok(triggered.contributors.length >= 2);
    assert.equal(triggered.persistence.observed, 2);
    const calm = h("C1");
    const bands = computeBaselines(calm.filter((r) => r.day <= 58));
    for (const row of calm.filter((r) => r.day === 59 || r.day === 60))
      for (const key of Object.keys(changes)) {
        const b = bands[key];
        (row as any)[key] = b.mean + b.expectedPerDay * (row.day - b.centerDay);
      }
    // Baseline-matched readings with nothing reported must stay Nominal. (Reported symptoms now count on
    // their own, see backend/tests/inputs.test.ts, so the calm case reports none.)
    const nothingReported =
      "symptoms" in context ? { symptoms: [], vision_score: 5 } : context;
    assert.equal(
      assessCrew(calm, 60, "mars_transit", nothingReported).risks.find(
        (r) => r.ruleId === ruleId,
      )!.level,
      "Nominal",
    );
  });
}
