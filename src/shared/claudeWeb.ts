import type { assessCrew } from "../engine/assessment.ts";
import type { Reading } from "../engine/types.ts";
import { isYou } from "../data/you.ts";
import { asksAboutData } from "./dataQuestion.ts";
import {
  crewContext,
  answerRejected,
  type LiveReading,
} from "./claudeContext.ts";
import { passagesFor } from "./evidenceSearch.ts";
import { triage, medicationAdvice } from "./triage.ts";
import { UNITS } from "./units.ts";
import type { AssistantReply, ConversationTurn } from "./assistantTypes.ts";

/** The hosted site has no server, so Claude is reached through HALO's small AI service (a Cloudflare Worker that holds the
 *  key, limits use and caps the total spend). Everything it returns is checked here; on any doubt the caller falls back to
 *  the on-board source answers. */
export const AI_URL: string =
  (import.meta as any).env?.VITE_HALO_AI_URL ??
  "https://halo-ai.nubidubi0977.workers.dev/claude";

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n) : s);
const strings = (v: unknown, n: number, len: number): string[] | null =>
  Array.isArray(v) && v.every((x) => typeof x === "string")
    ? v.slice(0, n).map((x) => clip(x as string, len))
    : null;

/** Same limits as the server's GeneratedAnswer, with over-long output trimmed instead of rejected */
export function parseClaude(text: string) {
  let o: any;
  try {
    o = JSON.parse(text);
  } catch {
    return null;
  }
  if (
    !o ||
    !Array.isArray(o.paragraphs) ||
    !o.paragraphs.length ||
    typeof o.insufficientEvidence !== "boolean"
  )
    return null;
  const paragraphs: {
    text: string;
    evidenceIds: string[];
    signalKeys: string[];
  }[] = [];
  for (const p of o.paragraphs.slice(0, 4)) {
    const evidenceIds = strings(p?.evidenceIds, 6, 100);
    const signalKeys = strings(p?.signalKeys, 8, 80);
    if (
      typeof p?.text !== "string" ||
      !p.text.trim() ||
      !evidenceIds ||
      !signalKeys
    )
      return null;
    paragraphs.push({
      text: clip(p.text.trim(), 1600),
      evidenceIds,
      signalKeys,
    });
  }
  const uncertainties = strings(o.uncertainties, 4, 400);
  const followUp = strings(o.followUp, 3, 200);
  if (!uncertainties || !followUp) return null;
  return {
    paragraphs,
    uncertainties,
    followUp,
    insufficientEvidence: o.insufficientEvidence as boolean,
  };
}

export type WebAsk = {
  question: string;
  history: ConversationTurn[];
  assessment: ReturnType<typeof assessCrew>;
  reading?: Reading;
  crewId: string;
  day: number;
  symptoms: string[];
  live?: LiveReading | null;
};

/** Why the hosted AI was not used, so the page can say so instead of quietly answering from the sources */
export type WebFail =
  "limit" | "rate" | "busy" | "unreachable" | "declined" | "checks";

export async function askClaudeOnWeb(
  a: WebAsk,
  fetchImpl: typeof fetch = fetch,
  onFail: (why: WebFail) => void = () => {},
): Promise<AssistantReply | null> {
  if (triage(a.question, a.symptoms).urgent || medicationAdvice(a.question))
    return null;
  const hint =
    a.symptoms.length &&
    /\b(?:symptoms?|logged|reported|noted)\b/i.test(a.question)
      ? ` ${a.symptoms.map((s) => s.replace(/_/g, " ")).join(" ")}`
      : "";
  const passages = passagesFor(a.question + hint);
  const asksData = asksAboutData(a.question);
  const attached = {
    loggedSymptoms: { today: a.symptoms, earlierThisWeek: [] },
    storedMeasurementsToday: [],
  };
  const ctx = crewContext({
    assessment: a.assessment,
    currentReading: a.reading,
    crewId: a.crewId,
    day: a.assessment.day,
    isYou: isYou(a.crewId),
    units: UNITS,
    attached,
    live: a.live ?? undefined,
  });
  if (!passages.length && !asksData) return null;
  if (
    !ctx.rawMeasurements.length &&
    !ctx.signals.length &&
    !a.live &&
    !ctx.hasSymptoms &&
    asksData &&
    !passages.length
  )
    return null;
  try {
    const res = await fetchImpl(AI_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        question: a.question,
        conversation: a.history.slice(-6),
        selectedCrewContext: ctx.selectedCrewContext,
        evidence: passages,
      }),
      signal: AbortSignal.timeout(60000),
    });
    const body = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      text?: string;
      reason?: string;
    };
    if (!res.ok) {
      onFail(
        body.reason === "budget_used_up"
          ? "limit"
          : body.reason === "rate_limited"
            ? "rate"
            : body.reason === "busy"
              ? "busy"
              : "unreachable",
      );
      return null;
    }
    if (!body.ok || typeof body.text !== "string") {
      onFail("declined");
      return null;
    }
    const g = parseClaude(body.text);
    if (
      !g ||
      answerRejected(g, new Set(passages.map((p) => p.id)), ctx.citableKeys)
    ) {
      onFail("checks");
      return null;
    }
    const cited = new Set(
      passages
        .filter((p) => g.paragraphs.some((x) => x.evidenceIds.includes(p.id)))
        .map((p) => p.sourceId),
    );
    return {
      mode: "grounded_ai",
      modelStatus: "available",
      providerDataSent: true,
      explanation: g.paragraphs.map((p) => p.text).join("\n\n"),
      paragraphs: g.paragraphs,
      citations: [...cited].flatMap((id) => {
        const p = passages.find((x) => x.sourceId === id)!;
        return [
          {
            id,
            title: p.title,
            source_url: p.sourceUrl,
            review_status: p.reviewStatus,
          },
        ];
      }),
      retrieval: {
        passages: passages.map((p) => ({
          id: p.id,
          sourceId: p.sourceId,
          text: p.text,
        })),
      },
      triage: { urgent: false },
      uncertainties: g.uncertainties,
      followUp: g.followUp,
      escalation:
        "Use the approved crew medical escalation process when needed.",
      limitations:
        "Written by a hosted AI model from HALO's source summaries. Not clinically reviewed, and not a diagnosis.",
    };
  } catch {
    onFail("unreachable");
    return null;
  }
}
