export const URGENT_SYMPTOMS = new Set([
  "chest_pain",
  "breathing_difficulty",
  "sudden_vision_loss",
  "confusion",
  "severe_pain",
]);
export const RED_FLAG_TEXT =
  /chest pain|can(?:not|'t|’t) breathe|short(?:ness)? of breath|sudden vision loss|lost my vision|can(?:not|'t|’t) see|difficulty breathing|trouble breathing|confus(?:ed|ion)|severe pain|faint(?:ed|ing)|passed out|blood in (?:my )?urine|kill myself|suicid|(?:ألم|الم|ضغط).{0,12}(?:الصدر|صدري)|(?:لا أستطيع|لا استطيع|صعوبة|ضيق).{0,10}(?:التنفس|تنفس)|فقدان مفاجئ.{0,8}(?:الرؤية|البصر)|أغمي علي|اغمي علي|أريد الانتحار|اريد الانتحار/iu;
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

export function medicationAdvice(question: string) {
  const medicine =
    /ibuprofen|paracetamol|acetaminophen|medic(?:ine|ation)|tablets?|pills?|drug|supplement|دواء|أدوية|ادوية|حبوب/iu.test(
      question,
    );
  const radiation = /radiation|dosimet|sievert|gray|إشعاع|اشعاع/iu.test(
    question,
  );
  const doseRequest =
    /dos(?:e|age)|prescri|جرعة/iu.test(question) && !(radiation && !medicine);
  const personalChange =
    medicine &&
    /how (?:much|many)|(?:should|can|may|could) i|(?:stop|start|change|increase|decrease|double|skip|take|use)\b|تناول|أتوقف|اوقف/iu.test(
      question,
    );
  return doseRequest || personalChange;
}
