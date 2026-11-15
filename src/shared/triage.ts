export const URGENT_SYMPTOMS = new Set([
  "chest_pain",
  "breathing_difficulty",
  "sudden_vision_loss",
  "confusion",
  "severe_pain",
]);
export const RED_FLAG_TEXT =
  /chest pain|worst headache|thunderclap|sudden severe headache|vision (?:went|goes|going|is going|turned) (?:dark|black)|lost (?:my )?sight|unconscious|\b(?:crewmate|crew member|commander|someone|somebody|person|he|she|they)\b.{0,24}(?:unresponsive|not responding|not breathing|collapsed)|stopped breathing|no pulse|i collapsed|seizure|convuls|throat (?:is )?(?:swelling|swollen|closing|tight)|swollen (?:throat|tongue|lips)|anaphyla|face (?:is )?droop|drooping face|slurred speech|speech is slurred|can(?:not|'t|’t) (?:move|feel) (?:my )?(?:arm|leg|face|hand)|(?:numb(?:ness)?|weak(?:ness)?) on one side|bleeding (?:heavily|a lot|won'?t stop)|(?:coughing|vomiting|throwing) up blood|don(?:'|’)?t want to (?:live|be alive|exist)|want to die|no reason to live|end (?:my life|it all)|hurt(?:ing)? myself|self[- ]harm|dolore al petto|non riesco a respirare|svenut|perso i sensi|non risponde|voglio morire|brustschmerz|schmerzen in der brust|kann nicht atmen|atemnot|bewusstlos|ich will sterben|dolor (?:de|en el) pecho|no puedo respirar|inconsciente|quiero morir|douleur (?:à la poitrine|thoracique)|je ne peux pas respirer|inconscient|je veux mourir|胸が痛い|胸の痛み|息ができない|呼吸ができない|意識がない|死にたい|can(?:not|'t|’t) breathe|short(?:ness)? of breath|sudden vision loss|lost my vision|can(?:not|'t|’t) see|difficulty breathing|trouble breathing|confus(?:ed|ion)|severe pain|faint(?:ed|ing)|passed out|blood in (?:my )?urine|kill myself|suicid|(?:ألم|الم|ضغط).{0,12}(?:الصدر|صدري)|(?:لا أستطيع|لا استطيع|صعوبة|ضيق).{0,10}(?:التنفس|تنفس)|فقدان مفاجئ.{0,8}(?:الرؤية|البصر)|أغمي علي|اغمي علي|أريد الانتحار|اريد الانتحار/iu;
// Added after the accuracy sets showed missed emergencies: blood loss, chest pressure, breathing trouble, stroke signs,
// collapse, self-harm, overdose, allergic reaction and cabin hazards, in more wordings and in nine languages.
export const RED_FLAG_MORE = new RegExp(
  [
    String.raw`(?:vomit(?:ed|ing)?|threw up|throw(?:ing)? up|cough(?:ed|ing)?(?: up)?|spit(?:ting)? up|pass(?:ed|ing)|bleed(?:ing)?)\s+(?:up\s+)?(?:some |a lot of |bright red |red )?blood`,
    String.raw`blood in (?:my )?(?:vomit|stool|sputum|spit)|black (?:tarry )?stools?|h(?:a)?emorrhag|(?:heavy|severe|massive|uncontrolled) bleeding|bleed(?:ing)? (?:badly|profusely|that won'?t stop|and (?:it )?won'?t stop|and (?:it )?will not stop)`,
    String.raw`(?:pressure|tightness|crushing|squeezing|heaviness|pain|pains|hurts?)\b.{0,30}\b(?:chest|jaw)\b|\bchest\b.{0,30}\b(?:pressure|tight(?:ness)?|crushing|squeez\w+|heav\w+|hurts?|pain|aches?|aching)\b|pain (?:is )?(?:spreading|radiating|going) (?:in)?to (?:my )?(?:jaw|left arm|arm|back)`,
    String.raw`struggling to breathe|gasping for|can'?t get (?:any |enough )?air|lips (?:are |turn(?:ing|ed) )?blue|blue lips|\bchoking\b`,
    String.raw`sudden(?:ly)?\W+(?:\w+\W+){0,6}?(?:numb\w*|weak\w*|(?:can'?t|cannot|unable to) (?:speak|talk|see|move|walk)|trouble (?:speaking|seeing|walking)|confus\w*)`,
    String.raw`(?:can'?t|cannot|unable to) (?:speak|talk) (?:properly|clearly|right|normally)|trouble speaking|slurring|my (?:arm|leg|face) (?:is |feels |has gone )?(?:weak|numb|limp)|one side of (?:my|the) (?:body|face)`,
    String.raw`blacked out|black(?:ing)? out|woke up on the floor|knocked out|won'?t wake up|not waking|lost consciousness|loss of consciousness`,
    String.raw`(?:can'?t|cannot|won'?t|unable to) stop (?:the |my )?bleeding|bleeding (?:won'?t|will not|doesn'?t) stop|(?:ending|end(?:ed)?) (?:my life|it all)|thoughts? of (?:ending|hurting|killing)|wish i (?:was|were) dead|want to disappear`,
    String.raw`killing myself|take my own life|taking my own life|better off dead|end my own life|don'?t want to be here anymore`,
    String.raw`overdos\w*|poison\w*|swallowed (?:too many|something|bleach)|took too many`,
    String.raw`can'?t swallow|(?:severe|serious|bad) allergic reaction|allergic reaction.{0,40}(?:breath|swell|swollen|throat|tongue|lips)`,
    String.raw`(?:cabin|module|station)\s+(?:fire|smoke|depressuri[sz]\w*)|ammonia leak|toxic (?:gas|smoke|fumes)|fire (?:on board|onboard|in the (?:cabin|module))|smell(?:s|ing)? (?:smoke|burning)`,
    // Heart pain and near-fainting, in several languages
    String.raw`casi me desmay|me duele (?:mucho )?el coraz[oó]n|coraz[oó]n (?:me )?duele|dolor (?:fuerte )?en el coraz[oó]n|mi fa male il cuore|quasi svenut|sto per svenire|j'ai failli m'[ée]vanouir|douleur (?:forte )?au c[oœ]ur|fast ohnm[äa]chtig|herzschmerzen|quase desmaiei|dor (?:forte )?no cora[çc][ãa]o`,
    // Italian
    String.raw`emorragia|vomit\w* sangue|sputo? sangue|non respira|ha smesso di respirare|forte dolore al petto|pressione al petto|ictus|crisi convulsiva|attacco epilettico|voglio uccidermi|overdose`,
    // Spanish
    String.raw`hemorragia|sangrado (?:fuerte|abundante)|sangra mucho|vomit\w* sangre|tos con sangre|no respira|dej[oó] de respirar|dolor fuerte en el pecho|opresi[oó]n en el pecho|derrame cerebral|convulsion|quiero matarme|sobredosis`,
    // French
    String.raw`h[ée]morragie|saigne (?:beaucoup|abondamment)|vomi\w* (?:du )?sang|crache\w* (?:du )?sang|ne respire plus|ne peux plus respirer|du mal [àa] respirer|crise d'[ée]pilepsie|convulsion|\bavc\b|[ée]vanou|perdu connaissance|douleur (?:forte |intense )?(?:dans|[àa]) la poitrine|oppression (?:dans|[àa]) la poitrine|me suicider|surdose`,
    // German
    String.raw`starke blutung|blutet stark|erbricht blut|hustet blut|atmet nicht|krampfanfall|schlaganfall|herzinfarkt|bringe mich um|umbringen|suizid|überdosis`,
    // Portuguese
    String.raw`n[ãa]o consigo respirar|dor (?:forte )?no peito|sangramento (?:forte|intenso)|vomit\w* sangue|desmaiei|convuls|quero morrer|suic[ií]d|overdose`,
    // Dutch
    String.raw`kan niet ademen|pijn op de borst|bloedt hevig|bloed braken|flauwgevallen|bewusteloos|epileptische aanval|wil dood`,
    // Chinese
    String.raw`呼吸困难|喘不过气|胸痛|胸口疼|大出血|吐血|咳血|昏迷|晕倒|抽搐|癫痫|中风|想自杀|不想活`,
    // Arabic
    String.raw`نزيف (?:شديد|حاد)|أتقيأ دم|اتقيأ دم|سعال.{0,6}دم|تشنج|سكتة|نوبة قلبية`,
  ].join("|"),
  "iu",
);
export const MEDICATION_TEXT =
  /dos(?:e|age)|prescri|ibuprofen|paracetamol|acetaminophen|medic(?:ine|ation)|tablets?|pills?|\bmg\b|stop.*drug|start.*drug/i;
export function triage(question: string, symptoms: string[] = []) {
  const flags = symptoms.filter((s) => URGENT_SYMPTOMS.has(s));
  if (RED_FLAG_TEXT.test(question) || RED_FLAG_MORE.test(question))
    flags.push("free_text_red_flag");
  return {
    urgent: flags.length > 0,
    flags,
    uncertainty:
      "Conservative prototype screen, not comprehensive emergency detection; negatives do not rule out emergencies.",
  };
}

export function medicationAdvice(question: string) {
  const medicine =
    /ibuprofen|paracetamol|acetaminophen|aspirin|medic(?:ine|ation)|tablets?|pills?|capsules?|drug|supplement|antibiotic|melatonin|sleep aid|sedative|epinephrine|epipen|adrenaline|insulin|painkiller|analgesic|antihistamine|steroid|opioid|morphine|naloxone|antidepressant|zolpidem|ambien|modafinil|promethazine|ondansetron|inhaler|vitamin|diphenhydramine|benadryl|naproxen|amoxicillin|oxycodone|tramadol|codeine|loratadine|cetirizine|omeprazole|prednisone|lorazepam|diazepam|valium|xanax|alprazolam|amitriptyline|sertraline|metformin|warfarin|heparin|sleeping|antibiotics|antiemetic|laxative|decongestant|caffeine|farmac|pastiglia|compressa|medikament|tablette|薬|دواء|أدوية|ادوية|حبوب/iu.test(
      question,
    );
  const radiation =
    /radiation|dosimet|sievert|\bgray\b|proton|cosmic|\bGCR\b|إشعاع|اشعاع/iu.test(
      question,
    );
  const doseRequest =
    /dos(?:e|age)|prescri|جرعة/iu.test(question) && !(radiation && !medicine);
  // A quantity in mg, mcg or IU is a dose even when the substance is not on the list (calcium, magnesium)
  const quantity = /\b(?:mg|mcg|µg|milligrams?|micrograms?|iu)\b/iu.test(
    question,
  );
  // "What is the evidence for melatonin use" is research, not a request for advice (no "I", "my" or "me")
  const researchQuestion =
    !/\b(?:i|i'm|i'd|i've|my|me|we|our|us)\b/iu.test(question) &&
    /\b(?:stud(?:y|ies)|trials?|research|evidence|papers?|reviews?|literature|reports?)\b/iu.test(
      question,
    );
  // "What should I take for nausea" asks for medicine advice without naming a medicine
  const takeFor =
    /what (?:should|can|could|do|may) i (?:take|use|swallow|drink|give)\b|\b(?:take|swallow) (?:something|anything) for\b|\bwhat to (?:take|use|swallow)\b|\bsomething to (?:take|swallow)\b|\b(?:suggest|recommend|prescribe) (?:me )?(?:something|anything)\b|\brecommend (?:me )?(?:a |an |some |something )?(?:painkillers?|medicines?|medications?|drugs?|pills?|tablets?|antibiotics?)\b/iu.test(
      question,
    );
  const personalChange =
    !researchQuestion &&
    ((quantity &&
      /(?:should|can|may|could|do) i\b|\btake\b|\btaking\b/iu.test(question)) ||
      medicine) &&
    /how (?:much|many)|(?:right|correct|safe|proper|appropriate|recommended|maximum|usual|typical|normal) (?:amount|quantity)|what amount|(?:should|can|may|could) i|(?:stop|start|increase|decrease|double|skip|take|use)\b|\bchange (?:my|the|your|a|an|some|\d+)\b|تناول|أتوقف|اوقف/iu.test(
      question,
    );
  return doseRequest || personalChange || takeFor;
}
