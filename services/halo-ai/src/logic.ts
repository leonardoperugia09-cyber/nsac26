// HALO's AI service: the part that can be tested without Cloudflare. It takes the question and context the browser built,
// adds the fixed system prompt, and asks Claude. It never trusts the caller: size, shape, rate and total spend are limited.
import {
  SYSTEM_PROMPT,
  providerAnswerSchema,
} from "../../../backend/node/assistant-model.ts";

export const MODEL = "claude-opus-5-5";
export const ALLOWED_ORIGINS = [
  "https://halo.nubidubi0977.workers.dev",
  "http://localhost:5173",
];

/** The caps. Each answer is counted as about 15 cents (a deliberately high guess), so 200 answers is about 30 dollars. */
export const LIMITS = {
  maxBodyBytes: 70_000,
  perIpWindowMs: 10 * 60_000,
  perIpWindowMax: 5,
  perIpDayMax: 25,
  perHourMax: 40,
  lifetimeMax: 200,
  concurrentMax: 3,
  inflightMs: 90_000,
};

type Storage = {
  get<T>(k: string): Promise<T | undefined>;
  put(entries: Record<string, unknown>): Promise<void>;
};
export type Gate = {
  ok: boolean;
  reason?: "budget_used_up" | "busy" | "rate_limited";
};

/** Counts requests in a strongly consistent store (a Durable Object), so concurrent callers cannot overshoot the caps */
export class Limiter {
  constructor(private s: Storage) {}
  async take(ip: string, now: number): Promise<Gate> {
    const total = (await this.s.get<number>("total")) ?? 0;
    if (total >= LIMITS.lifetimeMax)
      return { ok: false, reason: "budget_used_up" };
    const hourKey = `h:${Math.floor(now / 3_600_000)}`;
    const hourN = (await this.s.get<number>(hourKey)) ?? 0;
    if (hourN >= LIMITS.perHourMax) return { ok: false, reason: "busy" };
    const dayKey = `d:${Math.floor(now / 86_400_000)}:${ip}`;
    const dayN = (await this.s.get<number>(dayKey)) ?? 0;
    if (dayN >= LIMITS.perIpDayMax)
      return { ok: false, reason: "rate_limited" };
    const winKey = `w:${ip}`;
    const win = ((await this.s.get<number[]>(winKey)) ?? []).filter(
      (t) => now - t < LIMITS.perIpWindowMs,
    );
    if (win.length >= LIMITS.perIpWindowMax)
      return { ok: false, reason: "rate_limited" };
    const inflight = ((await this.s.get<number[]>("inflight")) ?? []).filter(
      (t) => now - t < LIMITS.inflightMs,
    );
    if (inflight.length >= LIMITS.concurrentMax)
      return { ok: false, reason: "busy" };
    await this.s.put({
      total: total + 1,
      [hourKey]: hourN + 1,
      [dayKey]: dayN + 1,
      [winKey]: [...win, now],
      inflight: [...inflight, now],
    });
    return { ok: true };
  }
  async done(now: number) {
    const inflight = ((await this.s.get<number[]>("inflight")) ?? []).filter(
      (t) => now - t < LIMITS.inflightMs,
    );
    inflight.shift();
    await this.s.put({ inflight });
  }
}

export type Ask = {
  question: string;
  conversation: { role: "user" | "assistant"; content: string }[];
  selectedCrewContext: object;
  evidence: object[];
};

const str = (v: unknown, max: number): v is string =>
  typeof v === "string" && v.length > 0 && v.length <= max;
export function parseAsk(
  raw: unknown,
): { ok: true; ask: Ask } | { ok: false; error: string } {
  const o = raw as any;
  if (!o || typeof o !== "object") return { ok: false, error: "bad_request" };
  if (!str(o.question, 2000)) return { ok: false, error: "bad_question" };
  const c = o.selectedCrewContext;
  if (
    !c ||
    typeof c !== "object" ||
    Array.isArray(c) ||
    JSON.stringify(c).length > 40_000
  )
    return { ok: false, error: "bad_context" };
  if (!Array.isArray(o.conversation) || o.conversation.length > 6)
    return { ok: false, error: "bad_conversation" };
  const conversation = [];
  for (const t of o.conversation) {
    if (
      !t ||
      (t.role !== "user" && t.role !== "assistant") ||
      !str(t.content, 2000)
    )
      return { ok: false, error: "bad_conversation" };
    conversation.push({ role: t.role, content: t.content });
  }
  if (!Array.isArray(o.evidence) || o.evidence.length > 8)
    return { ok: false, error: "bad_evidence" };
  const evidence = [];
  for (const p of o.evidence) {
    if (!p || !str(p.id, 100) || !str(p.text, 3000) || !str(p.title, 400))
      return { ok: false, error: "bad_evidence" };
    evidence.push({
      id: p.id,
      sourceId: String(p.sourceId ?? "").slice(0, 100),
      title: p.title,
      sourceUrl: String(p.sourceUrl ?? "").slice(0, 400),
      text: p.text,
      population: String(p.population ?? "").slice(0, 600),
      limitations: Array.isArray(p.limitations)
        ? p.limitations.slice(0, 6).map((x: unknown) => String(x).slice(0, 500))
        : [],
      reviewStatus: String(p.reviewStatus ?? "").slice(0, 60),
      kind: p.kind === "excerpt" ? "excerpt" : "summary",
    });
  }
  return {
    ok: true,
    ask: {
      question: o.question,
      conversation,
      selectedCrewContext: c,
      evidence,
    },
  };
}

/** The request to Claude: fixed model, prompt and answer format; only the question, context and evidence come from the caller */
export function claudeRequest(ask: Ask, apiKey: string): [string, RequestInit] {
  return [
    "https://api.anthropic.com/v1/messages?beta=true",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "server-side-fallback-2026-07-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 8000,
        thinking: { type: "adaptive" },
        output_config: {
          effort: "medium",
          format: { type: "json_schema", schema: providerAnswerSchema() },
        },
        fallbacks: "default",
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: JSON.stringify(ask) }],
      }),
      signal: AbortSignal.timeout(55_000),
    },
  ];
}

const cors = (origin: string | null): Record<string, string> => ({
  "access-control-allow-origin":
    origin && ALLOWED_ORIGINS.includes(origin) ? origin : "null",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type",
  vary: "origin",
});
const json = (status: number, body: unknown, origin: string | null) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...cors(origin) },
  });

export type Env = {
  ANTHROPIC_API_KEY: string;
  limiter: {
    take(ip: string, now: number): Promise<Gate>;
    done(now: number): Promise<void>;
  };
};

export async function handle(
  request: Request,
  env: Env,
  fetchImpl: typeof fetch = fetch,
  now = Date.now(),
): Promise<Response> {
  const origin = request.headers.get("origin");
  if (request.method === "OPTIONS")
    return new Response(null, { status: 204, headers: cors(origin) });
  if (
    request.method !== "POST" ||
    !new URL(request.url).pathname.endsWith("/claude")
  )
    return json(404, { ok: false, error: "not_found" }, origin);
  const text = await request.text();
  if (text.length > LIMITS.maxBodyBytes)
    return json(413, { ok: false, error: "too_large" }, origin);
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return json(400, { ok: false, error: "bad_request" }, origin);
  }
  const parsed = parseAsk(raw);
  if (!parsed.ok) return json(400, { ok: false, error: parsed.error }, origin);
  const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
  const gate = await env.limiter.take(ip, now);
  if (!gate.ok) return json(429, { ok: false, reason: gate.reason }, origin);
  try {
    const [url, init] = claudeRequest(parsed.ask, env.ANTHROPIC_API_KEY);
    const res = await fetchImpl(url, init);
    if (!res.ok)
      return json(502, { ok: false, error: "model_unavailable" }, origin);
    const reply = (await res.json()) as any;
    if (reply.stop_reason === "refusal")
      return json(200, { ok: false, reason: "refused" }, origin);
    if (reply.stop_reason !== "end_turn")
      return json(200, { ok: false, reason: "incomplete" }, origin);
    const block = (reply.content ?? []).find((b: any) => b.type === "text");
    if (!block?.text) return json(200, { ok: false, reason: "empty" }, origin);
    return json(200, { ok: true, text: block.text }, origin);
  } catch {
    return json(502, { ok: false, error: "model_unavailable" }, origin);
  } finally {
    await env.limiter.done(Date.now());
  }
}
