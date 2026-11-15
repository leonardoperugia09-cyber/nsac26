import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { makeServer } from "../node/app.ts";
const url = (path: string, crewId = "C2", day = 60) =>
  `/api/${path}?crewId=${crewId}&day=${day}&profile=mars_transit`;
const build = () => makeServer({ dbPath: ":memory:" });
test("health, JSON contracts, evidence and exact real source values", async () => {
  const a = await build();
  try {
    assert.equal((await a.inject("/health")).statusCode, 200);
    assert.equal((await a.inject("/openapi.json")).statusCode, 200);
    const m = (await a.inject("/api/crew")).json();
    assert.equal(m.readings, 360);
    assert.equal(m.crew.length, 3);
    const s = (await a.inject(url("snapshot"))).json();
    assert.equal(s.reading.fluid_intake_ml, 1416); // simulator regenerated with realistic in-flight values (653deb2)
    assert.equal(s.provenance.kind, "simulated");
    assert.equal(s.assessment.priority.level, "Act");
    assert.equal(
      (await a.inject("/api/offline-bundle")).json().manifest.records.length,
      7,
    );
  } finally {
    await a.close();
  }
});
test("API rejects malformed units, unknown fields and invalid crew/day", async () => {
  const a = await build();
  try {
    for (const u of [
      "/api/snapshot?crewId=C9&day=60",
      "/api/snapshot?crewId=C1&day=999",
    ])
      assert.equal((await a.inject(u)).statusCode, 422);
    const r = await a.inject({
      method: "POST",
      url: "/api/checkins",
      payload: { crewId: "C2", day: 60, measurements: { typo: 5 } },
    });
    assert.equal(r.statusCode, 422);
    assert.ok(!r.body.includes("stack"));
  } finally {
    await a.close();
  }
});
test("checkins persist and cannot leak across astronauts", async () => {
  const a = await build();
  try {
    const c1 = (await a.inject(url("snapshot", "C1"))).json().reading
      .fluid_intake_ml;
    assert.equal(
      (
        await a.inject({
          method: "POST",
          url: "/api/checkins",
          payload: {
            crewId: "C2",
            day: 60,
            measurements: { fluid_intake_ml: 2500 },
          },
        })
      ).statusCode,
      200,
    );
    assert.equal(
      (await a.inject(url("snapshot"))).json().reading.fluid_intake_ml,
      2500,
    );
    assert.equal(
      (await a.inject(url("snapshot", "C1"))).json().reading.fluid_intake_ml,
      c1,
    );
  } finally {
    await a.close();
  }
});
test("request authentication and body memory limit", async () => {
  const a = await makeServer({ dbPath: ":memory:", apiToken: "test-token" });
  try {
    assert.equal((await a.inject("/api/crew")).statusCode, 401);
    assert.equal(
      (
        await a.inject({
          url: "/api/crew",
          headers: { authorization: "Bearer test-token" },
        })
      ).statusCode,
      200,
    );
    assert.equal(
      (
        await a.inject({
          method: "POST",
          url: "/api/checkins",
          headers: {
            authorization: "Bearer test-token",
            "content-type": "application/json",
          },
          payload: "x".repeat(70000),
        })
      ).statusCode,
      413,
    );
  } finally {
    await a.close();
  }
});
test("report requires approval, has idempotent queueing and simulated delay", async () => {
  let now = Date.parse("2026-11-14T12:00:00Z");
  const a = await makeServer({ dbPath: ":memory:", now: () => now });
  try {
    const draft = (
      await a.inject({
        method: "POST",
        url: "/api/reports/draft",
        payload: { crewId: "C2", day: 60, profile: "mars_transit" },
      })
    ).json();
    assert.equal(draft.transmitted, false);
    assert.equal(
      (
        await a.inject({
          method: "POST",
          url: "/api/reports/queue",
          payload: {
            reportId: draft.id,
            approved: false,
            delaySeconds: 1200,
            idempotencyKey: "test-key-123",
          },
        })
      ).statusCode,
      422,
    );
    const payload = {
      reportId: draft.id,
      approved: true,
      delaySeconds: 1200,
      idempotencyKey: "test-key-123",
    };
    const q = (
      await a.inject({ method: "POST", url: "/api/reports/queue", payload })
    ).json();
    assert.equal(q.transport, "simulation_only");
    assert.deepEqual(
      (
        await a.inject({ method: "POST", url: "/api/reports/queue", payload })
      ).json(),
      q,
    );
    assert.equal(
      (await a.inject(url("outbox"))).json()[0].status,
      "in_transit_simulated",
    );
    now += 1200001;
    assert.equal(
      (await a.inject(url("outbox"))).json()[0].status,
      "delivered_simulated",
    );
    assert.equal((await a.inject(url("outbox", "C1"))).json().length, 0);
  } finally {
    await a.close();
  }
});
test("SQLite retains state across restarts", async () => {
  const dir = mkdtempSync(join(tmpdir(), "halo-test-"));
  let a = await makeServer({ dbPath: join(dir, "db.sqlite") });
  await a.inject({
    method: "POST",
    url: "/api/checkins",
    payload: { crewId: "C2", day: 60, measurements: { fluid_intake_ml: 2222 } },
  });
  await a.close();
  a = await makeServer({ dbPath: join(dir, "db.sqlite") });
  try {
    assert.equal(
      (await a.inject(url("snapshot"))).json().reading.fluid_intake_ml,
      2222,
    );
  } finally {
    await a.close();
    rmSync(dir, { recursive: true });
  }
});
test("medication records and adherence have no potency model", async () => {
  const a = await build();
  try {
    const med = {
      id: "test",
      crewId: "C2",
      name: "Demo medicine",
      scheduleReference: "demo-manifest-1",
      scheduledTime: "08:00",
      expiresAt: "2028-01-01T00:00:00Z",
      storageComplete: false,
      provenance: "demo_schedule",
    };
    assert.equal(
      (
        await a.inject({
          method: "POST",
          url: "/api/medications",
          payload: med,
        })
      ).statusCode,
      200,
    );
    await a.inject({
      method: "POST",
      url: "/api/adherence",
      payload: { crewId: "C2", medicationId: "test", day: 60, status: "taken" },
    });
    const r = (await a.inject(url("medications"))).json();
    assert.equal(r.items[0].potency, null);
    assert.equal(r.items[0].adherence[0].status, "taken");
    assert.equal(
      (await a.inject(url("medications", "C1"))).json().items.length,
      0,
    );
  } finally {
    await a.close();
  }
});
test("what-if is isolated from the actual demo records", async () => {
  const a = await build();
  try {
    const before = (await a.inject(url("snapshot"))).json();
    const r = (
      await a.inject({
        method: "POST",
        url: "/api/what-if",
        payload: {
          crewId: "C2",
          day: 60,
          profile: "mars_transit",
          horizon: 7,
          changes: { fluid_intake_ml: 2600 },
        },
      })
    ).json();
    assert.equal(r.projectedDays.length, 7);
    assert.match(r.assumptions, /No physiological/);
    assert.deepEqual((await a.inject(url("snapshot"))).json(), before);
  } finally {
    await a.close();
  }
});
test("radiation remains original quantity and historical cache is labelled stale", async () => {
  const a = await build();
  try {
    const r = (await a.inject("/api/radiation")).json();
    assert.equal(r.status, "stale");
    assert.equal(r.snapshot.unit, "uGy/h");
    assert.equal(r.live, false);
  } finally {
    await a.close();
  }
});
test("measurement review distinguishes missing/stale/future and unit errors", async () => {
  const a = await build();
  try {
    const m = {
      signal: "heart_rate",
      unit: "bpm",
      value: 60,
      sourceId: "test-device",
      provenance: "measured",
      observedAt: "2020-01-01T00:00:00Z",
    };
    const r = await a.inject({
      method: "POST",
      url: "/api/measurements/review",
      payload: { maxAgeSeconds: 3600, measurements: [m] },
    });
    assert.equal(r.json().signals[0].state, "stale");
    assert.equal(
      (
        await a.inject({
          method: "POST",
          url: "/api/measurements/review",
          payload: { measurements: [{ ...m, value: null }] },
        })
      ).json().signals[0].state,
      "missing",
    );
    assert.equal(
      (
        await a.inject({
          method: "POST",
          url: "/api/measurements/review",
          payload: { measurements: [{ ...m, unit: "Hz" }] },
        })
      ).statusCode,
      422,
    );
    assert.equal(
      (
        await a.inject({
          method: "POST",
          url: "/api/measurements/review",
          payload: {
            measurements: [
              { ...m, signal: "bone_resorption_index", unit: "demo index" },
            ],
          },
        })
      ).statusCode,
      422,
    );
  } finally {
    await a.close();
  }
});

test("saved emergency symptoms remain active when the next question is neutral", async () => {
  const a = await build();
  try {
    await a.inject({
      method: "POST",
      url: "/api/checkins",
      payload: {
        crewId: "C2",
        day: 60,
        measurements: {},
        symptoms: ["chest_pain"],
      },
    });
    const r = (
      await a.inject({
        method: "POST",
        url: "/api/assistant",
        payload: {
          crewId: "C2",
          day: 60,
          question: "explain my readings",
          profile: "mars_transit",
        },
      })
    ).json();
    assert.equal(r.triage.urgent, true);
  } finally {
    await a.close();
  }
});
test("recorded educational test affects only that astronaut and day", async () => {
  const a = await build();
  try {
    const before = (await a.inject(url("snapshot", "C1"))).json().reading
      .reaction_time_ms;
    const r = await a.inject({
      method: "POST",
      url: "/api/tests",
      payload: {
        crewId: "C2",
        day: 60,
        type: "reaction",
        values: [220, 230, 240],
        protocolVersion: "halo-demo-1",
      },
    });
    assert.equal(r.statusCode, 200);
    assert.equal(
      (await a.inject(url("snapshot"))).json().reading.reaction_time_ms,
      230,
    );
    assert.equal(
      (await a.inject(url("snapshot", "C1"))).json().reading.reaction_time_ms,
      before,
    );
  } finally {
    await a.close();
  }
});

test("audit logs contain metadata instead of assistant questions", async () => {
  const a = await build();
  try {
    await a.inject({
      method: "POST",
      url: "/api/assistant",
      payload: {
        crewId: "C2",
        day: 60,
        profile: "mars_transit",
        question: "PRIVATE TEXT DO NOT LOG",
      },
    });
    const logs = (await a.inject("/api/audit")).body;
    assert.ok(!logs.includes("PRIVATE TEXT"));
    assert.ok(logs.includes("/api/assistant"));
  } finally {
    await a.close();
  }
});

test("instrument measurements: store, list, unit check, server history and FHIR export", async () => {
  const a = await build();
  try {
    const post = (measurements: any[]) =>
      a.inject({
        method: "POST",
        url: "/api/measurements",
        payload: { crewId: "C2", measurements },
      });
    const hr = {
      signal: "heart_rate",
      value: 71,
      unit: "bpm",
      sourceId: "Polar H10",
      provenance: "measured",
      missionDay: 58,
      observedAt: "2026-11-14T09:00:00.000Z",
    };
    const bp = [
      {
        signal: "bp_sys",
        value: 118,
        unit: "mmHg",
        sourceId: "Cuff",
        provenance: "measured",
        missionDay: 58,
      },
      {
        signal: "bp_dia",
        value: 76,
        unit: "mmHg",
        sourceId: "Cuff",
        provenance: "measured",
        missionDay: 58,
      },
    ];
    const stored = await post([hr, ...bp]);
    assert.equal(stored.statusCode, 200);
    assert.equal(stored.json().stored, 3);
    const wrongUnit = await post([{ ...hr, unit: "Hz" }]);
    assert.equal(wrongUnit.statusCode, 422);
    const listed = (await a.inject(url("measurements", "C2", 58))).json();
    assert.equal(listed.length, 3);
    assert.ok(listed.every((m: any) => m.crewId === "C2" && m.recordedAt));
    assert.equal(
      (await a.inject(url("measurements", "C2", 57))).json().length,
      0,
    );
    // the stored strap reading replaces the simulator in the server's own view of the day
    assert.equal(
      (await a.inject(url("snapshot", "C2", 58))).json().reading.heart_rate,
      71,
    );
    const fhir = (await a.inject(url("fhir/Observation", "C2", 58))).json();
    assert.equal(fhir.resourceType, "Bundle");
    const obs = fhir.entry.map((e: any) => e.resource);
    const heart = obs.find((o: any) => o.code.coding[0].code === "8867-4");
    assert.equal(heart.valueQuantity.value, 71);
    assert.equal(heart.valueQuantity.code, "/min");
    assert.equal(heart.device.display, "Polar H10");
    assert.equal(heart.meta, undefined);
    const panel = obs.find((o: any) => o.code.coding[0].code === "85354-9");
    assert.deepEqual(
      panel.component.map((c: any) => c.code.coding[0].code),
      ["8480-6", "8462-4"],
    );
    const temp = obs.find((o: any) => o.code.coding[0].code === "8310-5");
    assert.equal(temp.meta.tag[0].code, "simulated");
  } finally {
    await a.close();
  }
});

test("medicine-day logs persist per crew/day without implying transmission", async () => {
  const a = await build();
  try {
    const state = {
      taken: { vitamin: "08:00" },
      skipped: {},
      extra: [],
      notes: [{ text: "Review stock", time: "09:00" }],
    };
    const saved = await a.inject({
      method: "POST",
      url: "/api/medication-day",
      payload: { crewId: "C2", day: 60, state },
    });
    assert.equal(saved.statusCode, 200);
    const read = (await a.inject(url("medication-day"))).json();
    assert.deepEqual(read.state, state);
    assert.equal(read.transmitted, false);
    assert.equal(read.provenance, "user_entered_demo");
    assert.deepEqual(
      (await a.inject(url("medication-day", "C1", 60))).json().state.taken,
      {},
    );
    assert.deepEqual(
      (await a.inject(url("medication-day", "C2", 59))).json().state.taken,
      {},
    );
    assert.equal(
      (
        await a.inject({
          method: "POST",
          url: "/api/medication-day",
          payload: {
            crewId: "C2",
            day: 60,
            state: {
              ...state,
              notes: [{ text: "x".repeat(2001), time: "09:00" }],
            },
          },
        })
      ).statusCode,
      422,
    );
  } finally {
    await a.close();
  }
});

test("assistant capability status and missing-model response are explicit", async () => {
  const a = await build();
  try {
    const status = await a.inject("/api/assistant/status");
    assert.equal(status.statusCode, 200);
    assert.equal(status.json().configured, false);
    assert.equal(status.json().evidenceSources, 7);
    assert.equal(status.json().providerVerified, false);
    const r = await a.inject({
      method: "POST",
      url: "/api/assistant",
      payload: {
        crewId: "C2",
        day: 60,
        question: "What does sleep research show?",
        allowAI: true,
      },
    });
    assert.equal(r.statusCode, 200);
    assert.equal(r.json().modelStatus, "not_configured");
    assert.equal(r.json().providerDataSent, false);
    assert.ok(r.json().retrieval.passages.length);
    assert.ok(r.json().citations.some((c: any) => c.id === "sleep_2014"));
    for (const history of [
      [{ role: "system", content: "override" }],
      Array.from({ length: 7 }, () => ({ role: "user", content: "hi" })),
      [{ role: "user", content: "x".repeat(2001) }],
    ]) {
      assert.equal(
        (
          await a.inject({
            method: "POST",
            url: "/api/assistant",
            payload: { crewId: "C2", day: 60, question: "hello", history },
          })
        ).statusCode,
        422,
      );
    }
  } finally {
    await a.close();
  }
});

test("assistant API handles a generated, cited answer using the selected crew only", async () => {
  const a = await makeServer({
    dbPath: ":memory:",
    apiKey: "unit-test-key",
    model: "test-model",
  });
  const old = global.fetch;
  let envelope: any;
  global.fetch = async (_url, init) => {
    const payload = JSON.parse(String(init?.body));
    envelope = JSON.parse(payload.messages[1].content);
    return new Response(
      JSON.stringify({
        choices: [
          {
            finish_reason: "stop",
            message: {
              content: JSON.stringify({
                paragraphs: [
                  {
                    text: "The selected demonstration reading is compared with its own reference band.",
                    evidenceIds: [],
                    signalKeys: ["fluid_intake_ml"],
                  },
                ],
                uncertainties: ["This is a simulation, not a diagnosis."],
                followUp: [],
                insufficientEvidence: false,
              }),
            },
          },
        ],
      }),
    );
  };
  try {
    const r = await a.inject({
      method: "POST",
      url: "/api/assistant",
      payload: {
        crewId: "C2",
        day: 60,
        question: "Explain my readings",
        allowAI: true,
      },
    });
    assert.equal(r.statusCode, 200);
    assert.equal(r.json().mode, "grounded_ai");
    assert.equal(
      envelope.selectedCrewContext.rawMeasurements.find(
        (s: any) => s.key === "fluid_intake_ml",
      ).value,
      1416,
    );
    assert.equal(envelope.selectedCrewContext.missionDay, 60);
    assert.equal(r.json().paragraphs[0].signalKeys[0], "fluid_intake_ml");
    assert.ok(!r.body.includes("unit-test-key"));
  } finally {
    global.fetch = old;
    await a.close();
  }
});

test("scenario editor: the server re-simulates an edited scenario, rejects bad ones and resets", async () => {
  const a = await build();
  try {
    const crew = (await a.inject("/api/crew")).json().crew;
    const { DEFAULT_EVENTS } = await import("../../src/sim/simulator.ts");
    const kidney = async () =>
      (await a.inject(url("risks", "C2", 58)))
        .json()
        .risks.find((r: any) => r.ruleId === "kidney_stone").level;
    assert.equal(await kidney(), "Act");
    // Marco no longer drinks less: the kidney stone risk must drop, and provenance must say so
    const calm = {
      crew: crew.map((c: any) =>
        c.id === "C1" ? { ...c, name: "Commander Ana Lima" } : c,
      ),
      events: DEFAULT_EVENTS.filter((e: any) => e.type !== "fluid_drop"),
      today: 58,
    };
    const applied = await a.inject({
      method: "POST",
      url: "/api/scenario",
      payload: calm,
    });
    assert.equal(applied.statusCode, 200);
    assert.notEqual(await kidney(), "Act");
    assert.equal(
      (await a.inject("/api/crew")).json().crew[0].name,
      "Commander Ana Lima",
    );
    assert.match(
      (await a.inject(url("snapshot", "C2", 58))).json().provenance.source,
      /scenario/,
    );
    // Wrong crew slots and out-of-range values are refused, and the data stays as it was
    const twoCrew = await a.inject({
      method: "POST",
      url: "/api/scenario",
      payload: { ...calm, crew: calm.crew.slice(0, 2) },
    });
    assert.equal(twoCrew.statusCode, 422);
    const badBaseline = await a.inject({
      method: "POST",
      url: "/api/scenario",
      payload: {
        ...calm,
        crew: calm.crew.map((c: any) => ({
          ...c,
          baseline: { ...c.baseline, heart_rate: 400 },
        })),
      },
    });
    assert.equal(badBaseline.statusCode, 422);
    assert.notEqual(await kidney(), "Act");
    // Reset brings back the bundled story
    const reset = await a.inject({
      method: "POST",
      url: "/api/scenario/reset",
      payload: {},
    });
    assert.equal(reset.statusCode, 200);
    assert.equal(await kidney(), "Act");
    assert.equal(
      (await a.inject(url("snapshot", "C2", 58))).json().provenance.source,
      "data/crew_sim.json",
    );
  } finally {
    await a.close();
  }
});
