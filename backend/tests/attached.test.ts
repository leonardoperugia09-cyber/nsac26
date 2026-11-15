import test from "node:test";
import assert from "node:assert/strict";
import { makeServer } from "../node/app.ts";

// A fake Claude that records what it was sent and answers by citing the attached data
const fakeClaude = (
  sent: { payload?: any },
  keys = ["logged_symptoms", "live_heart_rate"],
) => ({
  provider: "anthropic" as const,
  apiKey: "test-key",
  model: "claude-opus-5-5",
  anthropicClient: {
    beta: {
      messages: {
        create: async (p: any) => {
          sent.payload = JSON.parse(p.messages[0].content);
          return {
            stop_reason: "end_turn",
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  paragraphs: [
                    {
                      text: "You reported a headache and your strap shows one current value.",
                      evidenceIds: [],
                      signalKeys: keys,
                    },
                  ],
                  uncertainties: [],
                  followUp: [],
                  insufficientEvidence: false,
                }),
              },
            ],
          };
        },
      },
    },
  },
});

test("the assistant is sent the logged symptoms and the live strap reading, and may cite them", async () => {
  const sent: { payload?: any } = {};
  const app = await makeServer({ dbPath: ":memory:", ...fakeClaude(sent) });
  try {
    await app.inject({
      method: "POST",
      url: "/api/checkins",
      payload: {
        crewId: "C2",
        day: 58,
        measurements: {},
        symptoms: ["headache", "puffy_face"],
      },
    });
    const r = (
      await app.inject({
        method: "POST",
        url: "/api/assistant",
        payload: {
          crewId: "C2",
          day: 58,
          profile: "mars_transit",
          question: "How do my symptoms and heart rate look?",
          allowAI: true,
          live: { name: "Polar H10", simulated: false, bpm: 96, secondsAgo: 4 },
        },
      })
    ).json();
    const ctx = sent.payload.selectedCrewContext;
    assert.deepEqual(ctx.loggedSymptoms.today.sort(), [
      "headache",
      "puffy_face",
    ]);
    assert.equal(ctx.liveReading.bpm, 96);
    assert.equal(ctx.liveReading.name, "Polar H10");
    assert.match(ctx.liveReading.provenance, /measured/);
    assert.equal(r.mode, "grounded_ai");
    assert.deepEqual(r.paragraphs[0].signalKeys, [
      "logged_symptoms",
      "live_heart_rate",
    ]);
  } finally {
    await app.close();
  }
});

test("a simulated strap is labelled as simulated and a bad live value is rejected", async () => {
  const sent: { payload?: any } = {};
  const app = await makeServer({ dbPath: ":memory:", ...fakeClaude(sent) });
  try {
    await app.inject({
      method: "POST",
      url: "/api/assistant",
      payload: {
        crewId: "C1",
        day: 58,
        profile: "mars_transit",
        question: "What is my heart rate right now?",
        allowAI: true,
        live: {
          name: "Simulated strap",
          simulated: true,
          bpm: 62,
          secondsAgo: 2,
        },
      },
    });
    assert.match(
      sent.payload.selectedCrewContext.liveReading.provenance,
      /simulated/,
    );
    const bad = await app.inject({
      method: "POST",
      url: "/api/assistant",
      payload: {
        crewId: "C1",
        day: 58,
        profile: "mars_transit",
        question: "heart rate?",
        live: { name: "x", simulated: false, bpm: 999, secondsAgo: 1 },
      },
    });
    assert.equal(bad.statusCode, 422);
  } finally {
    await app.close();
  }
});

test("the symptom key may be cited to say that none were reported", async () => {
  const sent: { payload?: any } = {};
  const options = fakeClaude(sent, ["logged_symptoms"]);
  const app = await makeServer({ dbPath: ":memory:", ...options });
  try {
    const r = (
      await app.inject({
        method: "POST",
        url: "/api/assistant",
        payload: {
          crewId: "C1",
          day: 58,
          profile: "mars_transit",
          question: "Did I report any symptoms today?",
          allowAI: true,
        },
      })
    ).json();
    assert.deepEqual(sent.payload.selectedCrewContext.loggedSymptoms.today, []);
    assert.equal(r.mode, "grounded_ai", r.failureReason);
  } finally {
    await app.close();
  }
});

test("each signal sent to Claude says whether it is inside its reference range and how fast it is moving", async () => {
  const sent: { payload?: any } = {};
  const app = await makeServer({
    dbPath: ":memory:",
    ...fakeClaude(sent, ["heart_rate"]),
  });
  try {
    await app.inject({
      method: "POST",
      url: "/api/assistant",
      payload: {
        crewId: "C2",
        day: 58,
        profile: "mars_transit",
        question: "Is my heart rate normal for me?",
        allowAI: true,
      },
    });
    const signals = sent.payload.selectedCrewContext.signals;
    assert.ok(signals.length > 0);
    for (const s of signals) {
      assert.equal(typeof s.insideReferenceRange, "boolean");
      assert.equal(typeof s.trendScore, "number");
      assert.equal(
        s.insideReferenceRange,
        s.value >= s.reference[0] && s.value <= s.reference[1],
      );
    }
  } finally {
    await app.close();
  }
});
