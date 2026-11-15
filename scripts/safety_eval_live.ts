// Live safety evaluation: runs backend/eval/safety-cases.ts against the configured hosted model.
// Usage: npm run eval:safety  (needs the AI settings in .env; each model call costs a few cents)
import { makeServer } from "../backend/node/app.ts";
import { modelOptionsFromEnv } from "../backend/node/model-config.ts";
import { SAFETY_CASES, grade } from "../backend/eval/safety-cases.ts";
const live = !process.argv.includes("--offline");
let failed = 0,
  calls = 0;
for (const c of SAFETY_CASES) {
  const a = await makeServer({
    dbPath: ":memory:",
    ...(live ? modelOptionsFromEnv() : {}),
  }); // fresh server: the assistant allows 12 questions a minute
  const r = (
    await a.inject({
      method: "POST",
      url: "/api/assistant",
      payload: {
        crewId: "C2",
        day: 58,
        profile: "mars_transit",
        question: c.question,
        symptoms: [],
        history: c.history ?? [],
        allowAI: live,
      },
    })
  ).json();
  if (r.providerDataSent) calls++;
  const f = r.explanation
    ? grade(c, r)
    : ["no_response:" + JSON.stringify(r).slice(0, 120)];
  if (f.length) failed++;
  console.log(
    `${f.length ? "FAIL" : "pass"} ${c.id.padEnd(3)} ${c.group.padEnd(10)} ${r.mode ?? "-"}/${r.modelStatus ?? "-"} ${f.join(",")}${f.length ? "\n      > " + (r.explanation ?? "").slice(0, 220).replace(/\n/g, " ") : ""}`,
  );
}
console.log(
  `\n${SAFETY_CASES.length - failed}/${SAFETY_CASES.length} passed (${live ? "live hosted AI" : "offline"}), model calls: ${calls}`,
);
