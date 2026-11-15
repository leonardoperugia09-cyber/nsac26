/** Is the question about the person's own readings, risks or assessment? Shared by the server and the hosted offline assistant. */
const WORDS =
  /reading|measurement|risk|pattern|baseline|unknown|my data|changed|report|readiness|eva|docking|spacewalk|assessment|flagged|incomplete|my normal|what(?:'s| is) missing|\bsignals?\b|\bband\b|about me\b|قياس|قراءات|بيانات|مخاطر/iu;
const MY =
  /\b(?:my|me)\s+(?:\w+\s+)?(?:health|body|data|signals?|readings?|numbers?|risks?|status|sleep|heart|pulse|blood|temperature|weight|mass|mood|stress|muscles?|exercise|hydration|fluid|urine|oxygen|spo2|radiation|baseline|normal|assessment|kidney|bones?|workload|vision)|\bhow am i\b|\bhow (?:are|is) my\b|\bam i (?:ok|okay|at risk|drinking|sleeping|healthy)\b|\bdo i have (?:any |enough )?(?:risk|warning|flag|problem|data|baseline)/iu;
export const asksAboutData = (question: string) =>
  WORDS.test(question) || MY.test(question);
