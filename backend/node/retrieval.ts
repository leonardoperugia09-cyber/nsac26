import { readdirSync, readFileSync } from "node:fs";
import { evidence } from "./evidence.ts";

export type Passage = {
  id: string;
  sourceId: string;
  title: string;
  sourceUrl: string;
  text: string;
  population: string;
  limitations: string[];
  reviewStatus: string;
  /** summary: a claim authored and checked against the source; excerpt: verbatim text from a reusable full source */
  kind: "summary" | "excerpt";
};

// Only version-controlled material enters the index: authored summaries in evidence.json and verbatim excerpts
// of NASA (public use permitted) and CC BY sources in backend/resources/papers. No live web pages, user uploads,
// or model-written documents are trusted as evidence.
const summaries: Passage[] = evidence.flatMap((e: any) =>
  [
    ...e.supported_claims.map((text: string, i: number) => ({
      text,
      id: `${e.id}:claim:${i + 1}`,
    })),
    // Open questions the source itself raises, already worded as "not established"
    ...(e.hypotheses ?? []).map((text: string, i: number) => ({
      text,
      id: `${e.id}:hypothesis:${i + 1}`,
    })),
  ].map(({ text, id }) => ({
    id,
    sourceId: e.id,
    title: e.title,
    sourceUrl: e.source_url,
    text,
    population: e.studied_population,
    limitations: e.limitations,
    reviewStatus: e.review_status,
    kind: "summary" as const,
  })),
);

const PAPERS_DIR = new URL("../resources/papers/", import.meta.url);
// Paper furniture that is not evidence: declarations, contributions, funding, licence and access notes
const BOILERPLATE =
  /conflicts? of interest|competing interests?|author contributions?|acknowledg(?:e)?ments?|funding|data availability|publisher'?s note|open access this article|creative commons|reprints and permissions|correspondence and requests/i;
const bySource = new Map<string, any>(
  evidence.map((e: any) => [e.sourceId ?? e.id, e]),
);
function excerpts(): Passage[] {
  let files: string[] = [];
  try {
    files = readdirSync(PAPERS_DIR).filter((f) => f.endsWith(".json"));
  } catch {
    return []; // no full texts shipped: summaries only
  }
  return files.flatMap((f) => {
    const doc = JSON.parse(readFileSync(new URL(f, PAPERS_DIR), "utf8"));
    const record = bySource.get(doc.id);
    // A full text is only searchable when its source is in the curated library (title, population, limits)
    if (!record) return [];
    return doc.chunks
      .filter((c: { text: string }) => !BOILERPLATE.test(c.text.slice(0, 260)))
      .map((c: { id: string; text: string }) => ({
        id: c.id,
        sourceId: record.id,
        title: record.title,
        sourceUrl: record.source_url,
        text: c.text,
        population: record.studied_population,
        limitations: [
          `Verbatim excerpt from the full source (${doc.licence}); read it in context. HALO has not reviewed this excerpt.`,
          ...record.limitations,
        ],
        reviewStatus: record.review_status,
        kind: "excerpt" as const,
      }));
  });
}
export const passages: Passage[] = [...summaries, ...excerpts()];

const STOP = new Set(
  "a an and are as at be by can do does for from how i in is it me my of on or our that the their these this to was we what when which why with you your space spaceflight astronaut astronauts research evidence explain tell about during after before should would could will have has had been being not no yes also than then there into over under more most less very".split(
    " ",
  ),
);
const expansions: [RegExp, string][] = [
  [
    /kidney|renal|hydration|dehydrat|urine|salt|sodium|fluid intake|كلى|كلي|بول|حصى|جفاف/iu,
    "kidney renal dehydration calcium kidney stone urine volume",
  ],
  [
    /bone|skelet|calcium|fracture|عظام|كالسيوم/iu,
    "bone microgravity calcium loss density",
  ],
  [
    /sleep|fatigue|tired|insomnia|circadian|نوم|تعب/iu,
    "sleep deficiency circadian fatigue",
  ],
  [
    /cogniti|reaction|memory|attention|focus|ذاكرة/iu,
    "cognitive performance reaction time",
  ],
  [
    /muscle|exercise|resistance|strength|aerobic|عضلات|تمارين/iu,
    "muscle exercise strength aerobic",
  ],
  [
    /radiation|dosim|sievert|gray|solar|storm|إشعاع|اشعاع/iu,
    "radiation absorbed dose solar particle exposure",
  ],
  [
    /medicin|medicat|drug|pharma|potency|stability|storage|pill|expir|دواء|أدوية|ادوية/iu,
    "pharmaceutical formulations stability storage medication potency expiration",
  ],
  [
    /immune|virus|viral|cold sore|infection|shingles|مناعة|فيروس/iu,
    "herpesvirus reactivation immune",
  ],
  [
    /vision|eyes?\b|blurr|sans|optic|headache|نظر|رؤية/iu,
    "vision neuro ocular syndrome optic disc edema headward fluid shift",
  ],
  [
    /fluid shift|puffy|congest|headward|jugular/iu,
    "headward fluid shift jugular venous",
  ],
  [
    /dizz|faint|lightheaded|standing|orthostat|blood pressure/iu,
    "orthostatic intolerance hypotension standing",
  ],
  [
    /food|eat|calor|energy|weight|mass|nutrition/iu,
    "energy intake nutrition body mass",
  ],
  [
    /mood|stress|lonely|isolat|depress|anxi|behavio/iu,
    "behavioral health isolation confinement",
  ],
];
function tokens(s: string) {
  return (s.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).filter(
    (t) => t.length > 1 && !STOP.has(t),
  );
}

// Precomputed once: term counts per passage and how many passages contain each term (fast with thousands of excerpts)
const termCounts = passages.map((p) => {
  const counts = new Map<string, number>();
  for (const t of tokens(`${p.title} ${p.text}`))
    counts.set(t, (counts.get(t) ?? 0) + 1);
  return counts;
});
const lengths = termCounts.map((m) =>
  [...m.values()].reduce((a, b) => a + b, 0),
);
const averageLength =
  lengths.reduce((a, b) => a + b, 0) / Math.max(1, lengths.length);
const docFreq = new Map<string, number>();
for (const m of termCounts)
  for (const t of m.keys()) docFreq.set(t, (docFreq.get(t) ?? 0) + 1);

/** Below this, a match is too weak to count as evidence: the question is treated as not covered */
export const MIN_SCORE = 12; // calibrated 2026-11-15: real astronaut questions scored 15.8-36.5, off-topic ones at most 8.9
const SUMMARY_BOOST = 1.3; // checked summaries rank above raw excerpts of equal relevance
const PER_SOURCE = 2; // keep answers grounded in more than one long report

/** Scores of the last retrieve() call, for calibration and tests */
export const lastScores: number[] = [];

/** BM25 over summaries and excerpts: deterministic, auditable, no embedding service needed. */
export function retrieve(
  question: string,
  previousQuestions: string[] = [],
  limit = 6,
  minScore = MIN_SCORE,
): Passage[] {
  // Resolve short follow-ups without allowing unrelated past topics to dominate a new question.
  const query =
    tokens(question).length < 3 ||
    /\b(that|those|this|it|they|more)\b/i.test(question)
      ? [...previousQuestions.slice(-2), question].join(" ")
      : question;
  const expanded =
    query +
    " " +
    expansions
      .filter(([r]) => r.test(query))
      .map(([, s]) => s)
      .join(" ");
  const terms = [...new Set(tokens(expanded))];
  const n = passages.length;
  const scored: { passage: Passage; score: number }[] = [];
  for (let i = 0; i < n; i++) {
    const counts = termCounts[i];
    let score = 0;
    for (const term of terms) {
      const tf = counts.get(term);
      if (!tf) continue;
      const df = docFreq.get(term) ?? 0;
      const idf = Math.log(1 + (n - df + 0.5) / (df + 0.5));
      score +=
        (idf * tf * 2.2) /
        (tf + 1.2 * (0.25 + (0.75 * lengths[i]) / averageLength));
    }
    if (passages[i].kind === "summary") score *= SUMMARY_BOOST;
    if (score >= minScore) scored.push({ passage: passages[i], score });
  }
  scored.sort(
    (a, b) => b.score - a.score || a.passage.id.localeCompare(b.passage.id),
  );
  const max = Math.max(1, Math.min(8, limit));
  const out: (Passage & { score?: number })[] = [];
  const perSource = new Map<string, number>();
  lastScores.length = 0;
  for (const { passage } of scored) {
    const used = perSource.get(passage.sourceId) ?? 0;
    if (used >= PER_SOURCE) continue;
    perSource.set(passage.sourceId, used + 1);
    out.push(passage);
    lastScores.push(scored.find((x) => x.passage === passage)!.score);
    if (out.length >= max) break;
  }
  return out;
}
