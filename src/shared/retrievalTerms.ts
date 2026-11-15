// Words and phrase expansions that turn a question into search terms. Shared by the server's search over summaries and
// full-text excerpts (backend/node/retrieval.ts) and the browser's search over the summaries (src/shared/evidenceSearch.ts).
const STOP = new Set(
  "a an and are as at be by can do does for from how i in is it me my of on or our that the their these this to was we what when which why with you your space spaceflight astronaut astronauts research evidence explain tell about during after before should would could will have has had been being not no yes also than then there into over under more most less very".split(
    " ",
  ),
);
export const expansions: [RegExp, string][] = [
  [
    /kidney|renal|hydrat|thirst|urine|salt|sodium|fluid intake|water intake|كلى|كلي|بول|حصى|جفاف/iu,
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
export function tokens(s: string) {
  return (s.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).filter(
    (t) => t.length > 1 && !STOP.has(t),
  );
}
