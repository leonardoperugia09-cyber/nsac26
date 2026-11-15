import { makeServer } from "./node/app.ts";
import {
  modelOptionsFromEnv,
  resolveModelConfig,
} from "./node/model-config.ts";
// This is an intentional live provider check, not a mocked test. It may incur API usage.
let modelOptions;
try {
  modelOptions = modelOptionsFromEnv();
  resolveModelConfig(modelOptions);
} catch (error) {
  process.stderr.write(
    `LIVE AI NOT TESTED: ${error instanceof Error ? error.message : "Invalid model configuration."}\n`,
  );
  process.exit(2);
}
const app = await makeServer({
  dbPath: ":memory:",
  ...modelOptions,
});
try {
  const response = await app.inject({
    method: "POST",
    url: "/api/assistant",
    payload: {
      crewId: "C2",
      day: 60,
      question:
        "What does the supplied evidence say about sleep deficiency during spaceflight?",
      allowAI: true,
    },
  });
  const body = response.json();
  process.stdout.write(
    JSON.stringify(
      {
        httpStatus: response.statusCode,
        provider: modelOptions.provider,
        mode: body.mode,
        modelStatus: body.modelStatus,
        failureReason: body.failureReason,
        answer: body.explanation,
        sources: body.citations?.map((c: any) => c.source_url),
      },
      null,
      2,
    ) + "\n",
  );
  if (
    response.statusCode !== 200 ||
    body.mode !== "grounded_ai" ||
    body.modelStatus !== "available"
  )
    process.exitCode = 1;
} finally {
  await app.close();
}
