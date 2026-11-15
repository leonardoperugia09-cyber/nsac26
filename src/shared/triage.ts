export const URGENT_SYMPTOMS = new Set([
  "chest_pain",
  "breathing_difficulty",
  "sudden_vision_loss",
  "confusion",
  "severe_pain",
]);
export const RED_FLAG_TEXT =
  /chest pain|worst headache|thunderclap|sudden severe headache|vision (?:went|goes|going|is going|turned) (?:dark|black)|lost (?:my )?sight|unconscious|\b(?:crewmate|crew member|commander|someone|somebody|person|he|she|they)\b.{0,24}(?:unresponsive|not responding|not breathing|collapsed)|stopped breathing|no pulse|i collapsed|seizure|convuls|throat (?:is )?(?:swelling|swollen|closing|tight)|swollen (?:throat|tongue|lips)|anaphyla|face (?:is )?droop|drooping face|slurred speech|speech is slurred|can(?:not|'t|’t) (?:move|feel) (?:my )?(?:arm|leg|face|hand)|(?:numb(?:ness)?|weak(?:ness)?) on one side|bleeding (?:heavily|a lot|won'?t stop)|(?:coughing|vomiting|throwing) up blood|don(?:'|’)?t want to (?:live|be alive|exist)|want to die|no reason to live|end (?:my life|it all)|hurt(?:ing)? myself|self[- ]harm|dolore al petto|non riesco a respirare|svenut|perso i sensi|non risponde|voglio morire|brustschmerz|schmerzen in der brust|kann nicht atmen|atemnot|bewusstlos|ich will sterben|dolor (?:de|en el) pecho|no puedo respirar|inconsciente|quiero morir|douleur (?:à la poitrine|thoracique)|je ne peux pas respirer|inconscient|je veux mourir|胸が痛い|胸の痛み|息ができない|呼吸ができない|意識がない|死にたい|can(?:not|'t|’t) breathe|short(?:ness)? of breath|sudden vision loss|lost my vision|can(?:not|'t|’t) see|difficulty breathing|trouble breathing|confus(?:ed|ion)|severe pain|faint(?:ed|ing)|passed out|blood in (?:my )?urine|kill myself|suicid|(?:ألم|الم|ضغط).{0,12}(?:الصدر|صدري)|(?:لا أستطيع|لا استطيع|صعوبة|ضيق).{0,10}(?:التنفس|تنفس)|فقدان مفاجئ.{0,8}(?:الرؤية|البصر)|أغمي علي|اغمي علي|أريد الانتحار|اريد الانتحار/iu;
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
    /ibuprofen|paracetamol|acetaminophen|aspirin|medic(?:ine|ation)|tablets?|pills?|capsules?|drug|supplement|antibiotic|melatonin|sleep aid|sedative|epinephrine|epipen|adrenaline|insulin|painkiller|analgesic|antihistamine|steroid|opioid|morphine|naloxone|antidepressant|zolpidem|ambien|modafinil|promethazine|ondansetron|inhaler|vitamin|farmac|pastiglia|compressa|medikament|tablette|薬|دواء|أدوية|ادوية|حبوب/iu.test(
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
