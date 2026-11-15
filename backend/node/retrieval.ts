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
};

// Only authored, version-controlled summaries enter the index. No live web pages,
// user uploads, or model-written documents are automatically trusted as evidence.
export const passages: Passage[] = evidence.flatMap((e: any) =>
  e.supported_claims.map((text: string, i: number) => ({
    id: `${e.id}:claim:${i + 1}`,
    sourceId: e.id,
    title: e.title,
    sourceUrl: e.source_url,
    text,
    population: e.studied_population,
    limitations: e.limitations,
    reviewStatus: e.review_status,
  })),
);

const STOP = new Set(
  "a an and are as at be by can do does for from how i in is it me my of on or our that the their these this to was we what when which why with you your space spaceflight astronaut astronauts research evidence explain tell about during after before".split(
    " ",
  ),
);
const expansions: [RegExp, string][] = [
  [
    /kidney|renal|hydration|dehydrat|urine|salt|sodium|fluid intake|كلى|كلي|بول|حصى|جفاف/iu,
    "kidney renal dehydration calcium kidney stone",
  ],
  [/bone|skelet|calcium|عظام|كالسيوم/iu, "bone microgravity calcium"],
  [
    /sleep|fatigue|tired|cogniti|reaction|memory|نوم|تعب|ذاكرة/iu,
    "sleep deficiency astronaut",
  ],
  [/muscle|exercise|resistance|عضلات|تمارين/iu, "muscle exercise"],
  [
    /radiation|dosim|sievert|gray|إشعاع|اشعاع/iu,
    "radiation absorbed dose radlab",
  ],
  [
    /medicin|medicat|drug|pharma|potency|stability|storage|دواء|أدوية|ادوية/iu,
    "pharmaceutical formulations stability storage medication",
  ],
  [
    /immune|virus|viral|cold sore|مناعة|فيروس/iu,
    "herpesvirus reactivation immune",
  ],
  [
    /fluid shift|puffy|vision|eyes|headward|نظر|رؤية/iu,
    "headward fluid shifts microgravity",
  ],
];
function tokens(s: string) {
  return (s.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).filter(
    (t) => t.length > 1 && !STOP.has(t),
  );
}
const docs = passages.map((p) => tokens(`${p.title} ${p.text}`));
const averageLength = docs.reduce((n, d) => n + d.length, 0) / docs.length;

/** BM25 over this small library: deterministic, auditable, no embedding service needed. */
export function retrieve(
  question: string,
  previousQuestions: string[] = [],
  limit = 6,
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
  const ranked = docs
    .map((d, i) => {
      let score = 0;
      for (const term of terms) {
        const tf = d.filter((t) => t === term).length;
        if (!tf) continue;
        const df = docs.filter((doc) => doc.includes(term)).length;
        const idf = Math.log(1 + (docs.length - df + 0.5) / (df + 0.5));
        score +=
          (idf * tf * 2.2) /
          (tf + 1.2 * (0.25 + (0.75 * d.length) / averageLength));
      }
      return { passage: passages[i], score };
    })
    .filter((r) => r.score > 0)
    .sort(
      (a, b) => b.score - a.score || a.passage.id.localeCompare(b.passage.id),
    );
  return ranked.slice(0, Math.max(1, Math.min(8, limit))).map((r) => r.passage);
}
