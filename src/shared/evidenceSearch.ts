import raw from "../../backend/resources/evidence.json";
import { expansions, tokens } from "./retrievalTerms.ts";

/** Search over HALO's curated source summaries, in the browser, for the hosted app that has no server.
 *  Same BM25 idea as backend/node/retrieval.ts, but only the summaries (the full-text excerpts live on the server). */
const aliases: Record<string, string> = {
  nasa_human_body: "nasa_body",
  siew_kidney_2024: "kidney_2024",
  du_pharmaceuticals_2011: "drug_2011",
};
export type Source = {
  id: string;
  title: string;
  source_url: string;
  review_status: string;
  limitations: string[];
  studied_population: string;
};
const sources: (Source & {
  supported_claims: string[];
  hypotheses?: string[];
})[] = (raw.records as any[]).map((r) => ({
  ...r,
  id: aliases[r.id] ?? r.id,
  review_status: "domain_review_pending",
}));
export type Hit = { id: string; sourceId: string; text: string; score: number };

const passages = sources.flatMap((e) =>
  [
    ...e.supported_claims.map((text, i) => ({
      text,
      id: `${e.id}:claim:${i + 1}`,
    })),
    ...(e.hypotheses ?? []).map((text, i) => ({
      text,
      id: `${e.id}:hypothesis:${i + 1}`,
    })),
  ].map((p) => ({ ...p, sourceId: e.id, title: e.title })),
);
const counts = passages.map((p) => {
  const m = new Map<string, number>();
  for (const t of tokens(`${p.title} ${p.text}`)) m.set(t, (m.get(t) ?? 0) + 1);
  return m;
});
const lengths = counts.map((m) => [...m.values()].reduce((a, b) => a + b, 0));
const averageLength =
  lengths.reduce((a, b) => a + b, 0) / Math.max(1, lengths.length);
const docFreq = new Map<string, number>();
for (const m of counts)
  for (const t of m.keys()) docFreq.set(t, (docFreq.get(t) ?? 0) + 1);

/** Below this a match is too weak to count as evidence. Calibrated on questions the library should and should not cover. */
export const MIN_SCORE = 8;
const PER_SOURCE = 2;

export function searchEvidence(
  question: string,
  limit = 3,
  minScore = MIN_SCORE,
): Hit[] {
  const expanded =
    question +
    " " +
    expansions
      .filter(([r]) => r.test(question))
      .map(([, s]) => s)
      .join(" ");
  const terms = [...new Set(tokens(expanded))];
  const n = passages.length;
  const scored: Hit[] = [];
  for (let i = 0; i < n; i++) {
    let score = 0;
    for (const term of terms) {
      const tf = counts[i].get(term);
      if (!tf) continue;
      const df = docFreq.get(term) ?? 0;
      const idf = Math.log(1 + (n - df + 0.5) / (df + 0.5));
      score +=
        (idf * tf * 2.2) /
        (tf + 1.2 * (0.25 + (0.75 * lengths[i]) / averageLength));
    }
    if (score >= minScore)
      scored.push({
        id: passages[i].id,
        sourceId: passages[i].sourceId,
        text: passages[i].text,
        score,
      });
  }
  scored.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  const out: Hit[] = [];
  const perSource = new Map<string, number>();
  for (const h of scored) {
    if ((perSource.get(h.sourceId) ?? 0) >= PER_SOURCE) continue;
    perSource.set(h.sourceId, (perSource.get(h.sourceId) ?? 0) + 1);
    out.push(h);
    if (out.length >= limit) break;
  }
  return out;
}

export const sourceOf = (id: string) => sources.find((s) => s.id === id);

/** The passages in the shape the server gives Claude, so the hosted site's Claude sees the same kind of evidence */
export function passagesFor(question: string, limit = 6) {
  return searchEvidence(question, limit).map((h) => {
    const src = sourceOf(h.sourceId)!;
    return {
      id: h.id,
      sourceId: h.sourceId,
      title: src.title,
      sourceUrl: src.source_url,
      text: h.text,
      population: src.studied_population,
      limitations: src.limitations,
      reviewStatus: src.review_status,
      kind: "summary" as const,
    };
  });
}
