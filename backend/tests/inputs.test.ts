import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { evaluateRisks } from "../../src/engine/risks.ts";
import { assessCrew } from "../../src/engine/assessment.ts";
import type { Reading, SimData } from "../../src/engine/types.ts";

const data: SimData = JSON.parse(
  readFileSync(new URL("../../data/crew_sim.json", import.meta.url), "utf8"),
);
const history = (c: string): Reading[] =>
  data.readings.filter((r) => r.crew_id === c);
const risk = (rs: ReturnType<typeof evaluateRisks>, id: string) =>
  rs.find((r) => r.ruleId === id)!;

test("logged symptoms and a low vision self-report raise the fluid shift risk", () => {
  const before = risk(evaluateRisks(history("C1"), 58), "fluid_shift");
  const after = risk(
    evaluateRisks(history("C1"), 58, "mars_transit", {
      symptoms: ["headache", "puffy_face", "blurred_vision"],
      vision_score: 2,
    }),
    "fluid_shift",
  );
  assert.ok(after.score > before.score);
  assert.notEqual(after.level, "Nominal");
  assert.ok(after.contributors.some((c) => c.signal === "symptom_headache"));
  assert.ok(before.uncertainty.some((u) => u.startsWith("Missing inputs")));
  assert.ok(!after.uncertainty.some((u) => u.startsWith("Missing inputs")));
});

test("a cold sore and a skin problem raise the immune strain score", () => {
  const before = risk(evaluateRisks(history("C1"), 58), "immune_strain");
  const after = risk(
    evaluateRisks(history("C1"), 58, "mars_transit", {
      symptoms: ["cold_sore", "skin_symptoms"],
    }),
    "immune_strain",
  );
  assert.ok(after.score > before.score);
  assert.ok(after.contributors.some((c) => c.signal === "symptom_cold_sore"));
});

test("a logged workload of 5 counts in cognitive readiness and answers its missing input", () => {
  const h = history("C3").map((r) =>
    r.day === 58 ? { ...r, workload_1to5: 5 } : r,
  ) as Reading[];
  const before = risk(evaluateRisks(history("C3"), 58), "cognitive_readiness");
  const after = risk(evaluateRisks(h, 58), "cognitive_readiness");
  assert.ok(after.contributors.some((c) => c.signal === "workload_1to5"));
  assert.ok(after.score >= before.score);
  assert.ok(!after.uncertainty.some((u) => u.includes("workload")));
});

test("without logged inputs the demo story is unchanged", () => {
  assert.equal(
    risk(evaluateRisks(history("C2"), 58), "kidney_stone").level,
    "Act",
  );
  const a = assessCrew(history("C2"), 58, "mars_transit", {
    symptoms: [],
    vision_score: 4,
  });
  assert.equal(a.priority?.ruleId, "kidney_stone");
  // logged inputs never show up as missing readings
  for (const r of a.risks)
    assert.ok(
      !r.missing.some(
        (m: string) =>
          m.startsWith("symptom_") ||
          m === "vision_selfreport" ||
          m === "workload_1to5",
      ),
    );
});

test("'You' starts empty and fills only from real measurements and check-ins", async () => {
  const { makeServer } = await import("../node/app.ts");
  const a = await makeServer({ dbPath: ":memory:" });
  try {
    const snap = (
      await a.inject("/api/snapshot?crewId=U1&day=58&profile=mars_transit")
    ).json();
    assert.equal(snap.reading.heart_rate, null);
    assert.equal(snap.reading.radiation_mSv_today, null);
    // 60 days of watch data (as an Apple Health import produces) build a personal normal
    const measurements = Array.from({ length: 60 }, (_, i) => ({
      signal: "heart_rate",
      value: 60 + (i % 5),
      unit: "bpm",
      sourceId: "Apple Health",
      provenance: "measured",
      missionDay: i + 1,
    }));
    measurements[57].value = 95; // day 58: clearly above this person's normal
    const stored = await a.inject({
      method: "POST",
      url: "/api/measurements",
      payload: { crewId: "U1", measurements },
    });
    assert.equal(stored.statusCode, 200);
    const after = (
      await a.inject("/api/snapshot?crewId=U1&day=58&profile=mars_transit")
    ).json();
    assert.equal(after.reading.heart_rate, 95);
    assert.notEqual(after.assessment.drift.heart_rate?.status, "inside band");
    // a check-in with symptoms is accepted for "You"
    const checkin = await a.inject({
      method: "POST",
      url: "/api/checkins",
      payload: {
        crewId: "U1",
        day: 58,
        measurements: { workload_1to5: 4 },
        symptoms: ["headache"],
        vision_score: 4,
      },
    });
    assert.equal(checkin.statusCode, 200);
  } finally {
    await a.close();
  }
});

test("reported symptoms raise a risk even when its readings are not measured", () => {
  // like the "You" profile: no blood pressure, but headache, puffy face and blurred vision logged today
  const h = history("C1").map((r) => ({
    ...r,
    bp_sys: null,
    bp_dia: null,
  })) as unknown as Reading[];
  const quiet = assessCrew(h, 58, "mars_transit", {});
  assert.equal(
    quiet.risks.find((r: any) => r.ruleId === "fluid_shift")!.level,
    "Unknown",
  );
  const reported = assessCrew(h, 58, "mars_transit", {
    symptoms: ["headache", "puffy_face", "blurred_vision"],
    vision_score: 2,
  });
  const fluid = reported.risks.find((r: any) => r.ruleId === "fluid_shift")!;
  assert.ok(fluid.level === "Watch" || fluid.level === "Act", fluid.level);
  assert.ok(fluid.missing.length > 0); // the unmeasured readings stay visible
});
