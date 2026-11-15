/** Is the question about the person's own readings, risks or assessment? Shared by the server and the hosted offline assistant. */
const WORDS =
  /reading|measurement|risk|pattern|baseline|unknown|my data|changed|report|readiness|eva|docking|spacewalk|assessment|flagged|incomplete|my normal|what(?:'s| is) missing|\bsignals?\b|\bband\b|about me\b|\blogged\b|\bstrap\b|\bwhere i stand\b|\bhow (?:have|am|are) i\b|\bthis week\b|\bpast (?:week|few days|days)\b|\blast (?:week|few days)\b|\bhalo (?:tell|know|see|rate|track|assess)\b|\bcan'?t halo\b|\bwhat halo\b|قياس|قراءات|بيانات|مخاطر/iu;
const MY =
  /\b(?:my|me)\s+(?:\w+\s+)?(?:health|body|data|signals?|readings?|numbers?|risks?|status|sleep|heart|pulse|blood|temperature|weight|mass|mood|stress|muscles?|exercise|hydration|fluid|urine|oxygen|spo2|radiation|baseline|normal|assessment|kidney|bones?|workload|vision)|\bmy (?:symptoms?|skin|headache|face|vision|cold sore)\b|\bhow am i\b|\bhow (?:are|is) my\b|\bam i (?:ok|okay|at risk|drinking|sleeping|healthy)\b|\bdo i have (?:any |enough )?(?:risk|warning|flag|problem|data|baseline)/iu;
export const asksAboutData = (question: string) =>
  WORDS.test(question) || MY.test(question);
