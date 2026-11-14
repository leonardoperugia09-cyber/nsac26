export const URGENT_SYMPTOMS = new Set([
  "chest_pain",
  "breathing_difficulty",
  "sudden_vision_loss",
  "confusion",
  "severe_pain",
]);
export const RED_FLAG_TEXT =
  /chest pain|can(?:not|'t|’t) breathe|short(?:ness)? of breath|sudden vision loss|lost my vision|can(?:not|'t|’t) see|difficulty breathing|trouble breathing|confus(?:ed|ion)|severe pain|faint(?:ed|ing)|passed out|blood in (?:my )?urine|kill myself|suicid/i;
export const MEDICATION_TEXT =
  /dos(?:e|age)|prescri|ibuprofen|paracetamol|acetaminophen|medic(?:ine|ation)|tablets?|pills?|\bmg\b|stop.*drug|start.*drug/i;
export function triage(question: string, symptoms: string[] = []) {
  const flags = symptoms.filter((s) => URGENT_SYMPTOMS.has(s));
  if (RED_FLAG_TEXT.test(question)) flags.push("free_text_red_flag");
  return {
    urgent: flags.length > 0,
    flags,
    uncertainty:
      "Conservative prototype screen, not comprehensive emergency detection; negatives do not rule out emergencies.",
  };
}
