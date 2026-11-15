// Accuracy test: runs 100 cases (sets A, B, C: accuracy-cases*.ts); the pass rules are in those files.
// Usage: npm run eval:accuracy -- [--set a|b|c] [--offline] [--every 12] [--ids a,b,c]
// Live needs ANTHROPIC_API_KEY in .env: about 70 answers by Claude Opus 5.5 plus about 70 checks by Claude Sonnet 5.5.
import { writeFileSync } from "node:fs";
import { makeServer } from "../backend/node/app.ts";
import { modelOptionsFromEnv } from "../backend/node/model-config.ts";
import { retrieve } from "../backend/node/retrieval.ts";
import { grade } from "../backend/eval/safety-cases.ts";
import { ACC_CASES, type AccCase } from "../backend/eval/accuracy-cases.ts";
import { ACC_CASES_B } from "../backend/eval/accuracy-cases-b.ts";
import { ACC_CASES_C } from "../backend/eval/accuracy-cases-c.ts";
import { ACC_CASES_D } from "../backend/eval/accuracy-cases-d.ts";
import { ACC_CASES_E } from "../backend/eval/accuracy-cases-e.ts";
import {
  FLAGS,
  judge,
  judgeClient,
  spyClient,
} from "../backend/eval/accuracy-judge.ts";

const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const live = !process.argv.includes("--offline");
const setName = (arg("--set") ?? "a").toUpperCase();
const allCases = {
  A: ACC_CASES,
  B: ACC_CASES_B,
  C: ACC_CASES_C,
  D: ACC_CASES_D,
  E: ACC_CASES_E,
}[setName]!;
const every = Number(arg("--every") ?? 1);
const ids = arg("--ids")?.split(",");
const cases = allCases.filter((c, i) =>
  ids ? ids.includes(c.id) : i % every === 0,
);
const client = live ? judgeClient() : null;
const ALWAYS = [
  "no_dose",
  "no_clearance",
  "no_diagnosis",
  "no_transmission",
  "no_url",
  "no_prompt_leak",
];

async function pool<T, R>(
  items: T[],
  n: number,
  fn: (t: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (next < items.length) {
        const k = next++;
        out[k] = await fn(items[k]);
      }
    }),
  );
  return out;
}

async function run(c: AccCase) {
  const sent: { payload?: any; raw?: string } = {};
  const app = await makeServer({
    dbPath: ":memory:",
    ...(live
      ? { ...modelOptionsFromEnv(), anthropicClient: spyClient(sent) }
      : {}),
  });
  try {
    // Context cases: the symptoms were saved in today's check-in, and the strap reading arrives with the question
    if (c.logged)
      await app.inject({
        method: "POST",
        url: "/api/checkins",
        payload: {
          crewId: c.crewId,
          day: c.day,
          measurements: {},
          symptoms: c.logged,
        },
      });
    const res = await app.inject({
      method: "POST",
      url: "/api/assistant",
      payload: {
        crewId: c.crewId,
        day: c.day,
        profile: "mars_transit",
        question: c.question,
        symptoms: [],
        live: c.live,
        history: c.history ?? [],
        allowAI: live,
      },
    });
    const r: any = res.json();
    const reasons: string[] = [];
    let verdict: any = null;
    if (!r.explanation)
      return {
        c,
        pass: false,
        reasons: ["no_response:" + JSON.stringify(r).slice(0, 120)],
        r,
        verdict,
        sent: sent.payload,
        raw: sent.raw,
      };
    const checks = [
      ...ALWAYS,
      ...(c.expect === "urgent"
        ? ["urgent", "no_model_call"]
        : c.expect === "refusal"
          ? ["medication_refusal"]
          : []),
    ];
    reasons.push(...grade({ checks } as any, r));
    // The empty "You" profile has no readings, so a question about it cannot be answered from the library either
    const covered =
      c.kind === "context"
        ? true
        : c.kind === "data"
          ? c.crewId !== "U1"
          : retrieve(c.question).length > 0;
    if (c.expect === "answer") {
      if (r.modelStatus === "safety_bypass") reasons.push("false_alarm");
      else if (r.modelStatus === "insufficient_evidence") {
        if (covered) reasons.push("declined_but_covered");
      } else if (live && r.mode !== "grounded_ai")
        reasons.push("ai_did_not_answer:" + (r.failureReason ?? r.modelStatus));
      else if (
        !live &&
        covered &&
        /does not cover this question/i.test(r.explanation)
      )
        reasons.push("declined_but_covered");
    }
    if (
      live &&
      r.mode === "grounded_ai" &&
      sent.payload &&
      c.expect !== "urgent" &&
      c.expect !== "refusal"
    ) {
      try {
        verdict = await judge(client!, {
          question: c.question,
          sentToAssistant: sent.payload,
          answer: {
            paragraphs: r.paragraphs,
            uncertainties: r.uncertainties,
            followUp: r.followUp,
            insufficientEvidence: r.insufficientEvidence,
          },
        });
      } catch (e: any) {
        reasons.push("judge_error:" + String(e?.message ?? e).slice(0, 80));
      }
      if (verdict)
        for (const k of FLAGS) if (!verdict[k]) reasons.push("judge_" + k);
    }
    return {
      c,
      pass: reasons.length === 0,
      reasons,
      r,
      verdict,
      sent: sent.payload,
      raw: sent.raw,
    };
  } finally {
    await app.close();
  }
}

const results = await pool(cases, live ? 4 : 8, run);
let modelCalls = 0,
  judgeCalls = 0;
for (const x of results) {
  if (x.r?.providerDataSent) modelCalls++;
  if (x.verdict) judgeCalls++;
  console.log(
    `${x.pass ? "pass" : "FAIL"} ${x.c.id.padEnd(6)} ${x.r?.mode ?? "-"}/${x.r?.modelStatus ?? "-"} ${x.reasons.join(",")}${x.pass ? "" : `\n      Q: ${x.c.question}\n      A: ${(x.r?.explanation ?? "").replace(/\n/g, " ").slice(0, 260)}${x.verdict?.problems?.length ? "\n      judge: " + x.verdict.problems.join(" | ").slice(0, 400) : ""}`}`,
  );
}
const passed = results.filter((x) => x.pass).length;
console.log("\nBy kind:");
for (const k of [...new Set(cases.map((c) => c.kind))]) {
  const xs = results.filter((x) => x.c.kind === k);
  console.log(
    `  ${k.padEnd(10)} ${xs.filter((x) => x.pass).length}/${xs.length}`,
  );
}
const answerCases = results.filter((x) => x.c.expect === "answer");
const declined = answerCases.filter(
  (x) =>
    x.r?.insufficientEvidence || x.r?.modelStatus === "insufficient_evidence",
).length;
console.log(
  `\nDeclined as "not in the library": ${declined} of ${answerCases.length} answer cases (a correct decline passes, but it is not a useful answer)`,
);
console.log(
  `${passed}/${results.length} passed (${live ? "live Claude" : "offline"}, set ${setName}); answers by Claude: ${modelCalls}, judge checks: ${judgeCalls}`,
);
const out = new URL(
  `../backend/eval/last-accuracy-run-${setName === "A" ? "" : setName.toLowerCase() + "-"}${live ? "live" : "offline"}${every > 1 || ids ? "-partial" : ""}.json`,
  import.meta.url,
);
writeFileSync(
  out,
  JSON.stringify(
    {
      when: new Date().toISOString(),
      live,
      set: setName,
      passed,
      total: results.length,
      results: results.map((x: any) => ({
        id: x.c.id,
        kind: x.c.kind,
        question: x.c.question,
        pass: x.pass,
        reasons: x.reasons,
        mode: x.r?.mode,
        modelStatus: x.r?.modelStatus,
        failureReason: x.r?.failureReason,
        explanation: x.r?.explanation,
        paragraphs: x.r?.paragraphs,
        uncertainties: x.r?.uncertainties,
        verdict: x.verdict,
        sent: x.sent,
        raw: x.reasons.some((q: string) => q.startsWith("ai_did_not_answer"))
          ? (x as any).raw
          : undefined,
      })),
    },
    null,
    1,
  ),
);
console.log("Details: " + out.pathname);
