import test from "node:test";
import assert from "node:assert/strict";
import {
  azureBaseUrl,
  modelOptionsFromEnv,
  resolveModelConfig,
  type ModelOptions,
} from "../node/model-config.ts";
import { answer, assistantStatus } from "../node/assistant.ts";
import { loadDataset } from "../node/data.ts";
import { assessCrew } from "../../src/engine/assessment.ts";
import { makeServer } from "../node/app.ts";
const azure: ModelOptions = {
  provider: "azure",
  apiKey: "azure-test-secret",
  model: "halo-assistant",
  azureEndpoint: "https://halo-demo.openai.azure.com/",
};
const { data } = loadDataset();
const assessment = assessCrew(
  data.readings.filter((r) => r.crew_id === "C2"),
  60,
);
const question = {
  crewId: "C2",
  day: 60,
  question: "What does research say about sleep in space?",
  allowAI: true,
  symptoms: [],
};
const completion = () =>
  new Response(
    JSON.stringify({
      choices: [
        {
          finish_reason: "stop",
          message: {
            content: JSON.stringify({
              paragraphs: [
                {
                  text: "The observational study documents sleep deficiency in the studied astronaut cohorts.",
                  evidenceIds: ["sleep_2014:claim:1"],
                  signalKeys: [],
                },
              ],
              uncertainties: [
                "The study does not establish individual readiness.",
              ],
              followUp: [],
              insufficientEvidence: false,
            }),
          },
        },
      ],
    }),
  );
async function mocked(fake: typeof fetch, fn: () => Promise<void>) {
  const old = global.fetch;
  global.fetch = fake;
  try {
    await fn();
  } finally {
    global.fetch = old;
  }
}

test("Azure environment selection uses its own key and deployment, never direct OpenAI credentials", () => {
  const env = {
    AI_PROVIDER: "azure",
    AI_API_KEY: "wrong-key",
    HALO_MODEL: "wrong-model",
    AZURE_OPENAI_API_KEY: " azure-key ",
    AZURE_OPENAI_DEPLOYMENT: " halo-assistant ",
    AZURE_OPENAI_ENDPOINT: azure.azureEndpoint,
  };
  const selected = modelOptionsFromEnv(env);
  assert.equal(selected.apiKey, "azure-key");
  assert.equal(selected.model, "halo-assistant");
  assert.equal(selected.provider, "azure");
  const legacy = modelOptionsFromEnv({ ...env, AI_PROVIDER: "openai" });
  assert.equal(legacy.apiKey, "wrong-key");
  assert.equal(legacy.model, "wrong-model");
  const missing = modelOptionsFromEnv({
    AI_PROVIDER: "azure",
    AI_API_KEY: "not-for-azure",
    HALO_MODEL: "not-for-azure",
  });
  assert.equal(missing.apiKey, undefined);
  assert.equal(assistantStatus(missing).configured, false);
  assert.throws(
    () => modelOptionsFromEnv({ AI_PROVIDER: "unknown" }),
    /AI_PROVIDER must/,
  );
});
for (const url of [
  "https://halo-demo.openai.azure.com",
  "https://halo-demo.openai.azure.com/",
  "https://halo-demo.openai.azure.com/openai/v1",
  "https://halo-demo.openai.azure.com/openai/v1/",
  "https://halo-demo.services.ai.azure.com/",
]) {
  test(`Azure resource URL normalizes once: ${url}`, () => {
    assert.match(
      azureBaseUrl(url),
      /^https:\/\/halo-demo\.(?:openai\.azure\.com|services\.ai\.azure\.com)\/openai\/v1\/$/,
    );
    assert.equal(
      resolveModelConfig({ ...azure, azureEndpoint: url }).url,
      azureBaseUrl(url) + "chat/completions",
    );
  });
}
for (const url of [
  "http://halo-demo.openai.azure.com",
  "https://halo-demo.openai.azure.com.evil.invalid/",
  "https://evil.invalid",
  "https://127.0.0.1/",
  "https://user:private-secret@halo-demo.openai.azure.com/",
  "https://halo-demo.openai.azure.com/?key=private-secret",
  "https://halo-demo.openai.azure.com/#private-secret",
  "https://halo-demo.openai.azure.com:8080/",
  "https://halo-demo.services.ai.azure.com/api/projects/halo",
  "https://halo-demo.openai.azure.com/openai/v1/chat/completions",
  "/openai/v1/",
]) {
  test(
    "invalid Azure endpoint is rejected without exposing credentials: " +
      url.replaceAll("private-secret", "redacted"),
    () => {
      assert.throws(
        () => azureBaseUrl(url),
        (error: unknown) =>
          error instanceof Error &&
          /AZURE_OPENAI_ENDPOINT/.test(error.message) &&
          !error.message.includes("private-secret"),
      );
    },
  );
}
test("Azure v1 generation sends the deployment and API-key header to the Azure resource only", async () => {
  let calls = 0;
  await mocked(
    async (url, init) => {
      calls++;
      assert.equal(
        url,
        "https://halo-demo.openai.azure.com/openai/v1/chat/completions",
      );
      const headers = new Headers(init?.headers);
      assert.equal(headers.get("api-key"), azure.apiKey);
      assert.equal(headers.has("Authorization"), false);
      assert.equal(init?.redirect, "error");
      const body = JSON.parse(String(init?.body));
      assert.equal(body.model, "halo-assistant");
      assert.equal(body.response_format.type, "json_schema");
      assert.equal(body.max_completion_tokens, 1800);
      assert.equal(body.store, false);
      return completion();
    },
    async () => {
      const r = await answer(question, assessment, azure);
      assert.equal(r.mode, "grounded_ai");
      assert.equal(r.modelStatus, "available");
      assert.equal(calls, 1);
      assert.equal(r.citations[0].id, "sleep_2014");
      assert.ok(!JSON.stringify(r).includes(azure.apiKey!));
    },
  );
});
test("Azure status names missing fields without claiming connection or exposing endpoint/key", () => {
  const complete = assistantStatus(azure);
  assert.equal(complete.provider, "azure");
  assert.equal(complete.model, "halo-assistant");
  assert.equal(complete.configured, true);
  assert.equal(complete.providerVerified, false);
  assert.ok(!JSON.stringify(complete).includes(azure.apiKey!));
  assert.ok(!JSON.stringify(complete).includes(azure.azureEndpoint!));
  for (const key of ["apiKey", "model", "azureEndpoint"] as const) {
    assert.equal(
      assistantStatus({ ...azure, [key]: undefined }).status,
      "not_configured",
    );
  }
  const invalid = assistantStatus({
    ...azure,
    azureEndpoint: "https://private-secret.invalid",
  });
  assert.equal(invalid.status, "invalid_configuration");
  assert.ok(!JSON.stringify(invalid).includes("private-secret"));
});
test("invalid Azure configuration never calls a provider or fails over to OpenAI", async () => {
  await mocked(
    async () => {
      assert.fail("must not call any provider");
    },
    async () => {
      for (const options of [
        { ...azure, azureEndpoint: "http://localhost:3001" },
        { ...azure, azureEndpoint: undefined },
        { ...azure, apiKey: undefined },
      ]) {
        const r = await answer(question, assessment, options);
        assert.equal(r.mode, "offline_rules");
        assert.equal(r.providerDataSent, false);
        assert.ok(
          ["not_configured", "invalid_configuration"].includes(r.modelStatus),
        );
      }
    },
  );
});
for (const [status, reason] of [
  [400, "unsupported_request"],
  [401, "authentication_error"],
  [403, "access_denied"],
  [404, "deployment_not_found"],
  [429, "rate_limit_or_quota"],
  [503, "provider_error"],
] as const) {
  test(`Azure HTTP ${status} has safe, actionable failure classification`, async () => {
    let calls = 0;
    await mocked(
      async () => {
        calls++;
        return new Response("provider-body-private-secret", { status });
      },
      async () => {
        const r = await answer(question, assessment, azure);
        assert.equal(r.failureReason, reason);
        assert.equal(r.mode, "offline_rules");
        assert.equal(calls, 1);
        assert.ok(!JSON.stringify(r).includes("provider-body-private-secret"));
      },
    );
  });
}
test("Azure-selected API exposes capability and successfully parses a generated answer", async () => {
  const app = await makeServer({ ...azure, dbPath: ":memory:" });
  try {
    const status = await app.inject("/api/assistant/status");
    assert.equal(status.json().provider, "azure");
    assert.equal(status.json().configured, true);
    assert.ok(!status.body.includes(azure.apiKey!));
    await mocked(
      async () => completion(),
      async () => {
        const response = await app.inject({
          method: "POST",
          url: "/api/assistant",
          payload: question,
        });
        assert.equal(response.statusCode, 200);
        assert.equal(response.json().mode, "grounded_ai");
      },
    );
  } finally {
    await app.close();
  }
});

test("Azure request schema omits unsupported bounds while local validation retains them", async () => {
  const { providerAnswerSchema, GeneratedAnswer } =
    await import("../node/assistant-model.ts");
  const schema = JSON.stringify(providerAnswerSchema());
  assert.ok(!/minLength|maxLength|minItems|maxItems|\$schema/.test(schema));
  assert.ok(schema.includes('"additionalProperties":false'));
  assert.equal(
    GeneratedAnswer.safeParse({
      paragraphs: [],
      uncertainties: [],
      followUp: [],
      insufficientEvidence: false,
    }).success,
    false,
  );
});
