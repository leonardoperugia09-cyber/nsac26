import type { assessCrew } from "../engine/assessment.ts";
import type { Reading } from "../engine/types.ts";

/** What the assistant is given about the person, and the checks on what it says back.
 *  Shared by the server (backend/node/assistant.ts) and the browser (the hosted site's Claude). */

// This screen catches selected high-risk output patterns, not all possible medical errors.
// Citation-ID checks verify traceability, not whether the source entails generated prose.
export const UNSAFE_OUTPUT =
  /\b(?:take|swallow|inject|drink|administer)\s+(?:up to\s+)?\d+(?:\.\d+)?\s*(?:mg|mcg|ml|litres?|liters?|tablets?|pills?)\b|\b(?:start|stop|double|increase|decrease|skip|change)\b[^.!?\n]{0,35}\b(?:your |the )?(?:dose|medication|medicine|tablets?|pills?)\b|\byou (?:have|are diagnosed with|definitely have) (?:a |an )?(?:kidney stone|renal failure|infection|disease|syndrome)\b|\b(?:you are|you're) (?:cleared|fit|safe) (?:for|to)|\b(?:ignore|override) (?:the |your )?(?:doctor|medical officer|protocol)/i;

export type Attached = {
  loggedSymptoms: {
    today: string[];
    earlierThisWeek: { day: number; symptoms: string[] }[];
  };
  storedMeasurementsToday: unknown[];
};
export type LiveReading = {
  name: string;
  simulated: boolean;
  bpm: number;
  secondsAgo: number;
};

export function crewContext(a: {
  assessment: ReturnType<typeof assessCrew>;
  currentReading?: Reading;
  crewId: string;
  day: number;
  isYou: boolean;
  units: Record<string, string>;
  attached?: Attached;
  live?: LiveReading;
}) {
  const { assessment, currentReading, units } = a;
  const rawMeasurements =
    currentReading?.crew_id === a.crewId && currentReading.day === a.day
      ? Object.entries(units)
          .filter(
            ([key]) =>
              typeof currentReading[key as keyof Reading] === "number" &&
              Number.isFinite(currentReading[key as keyof Reading]),
          )
          .map(([key, unit]) => ({
            key,
            unit,
            value: currentReading[key as keyof Reading],
            missionDay: a.day,
          }))
      : [];
  const signals = Object.entries(assessment.drift).map(([key, d]) => ({
    key,
    value: d.value,
    unit: units[key] ?? "demo index",
    reference: [d.bandLo, d.bandHi],
    status: d.status,
    insideReferenceRange: d.value >= d.bandLo && d.value <= d.bandHi,
    trendScore: Math.round(d.howFast * 100) / 100,
    valueBasis: "engine current value; slow signals may be recent averages",
  }));
  // Symptoms the astronaut reported count as something to ground an answer in
  const hasSymptoms =
    !!a.attached &&
    (a.attached.loggedSymptoms.today.length > 0 ||
      a.attached.loggedSymptoms.earlierThisWeek.length > 0);
  const selectedCrewContext = {
    missionDay: assessment.day,
    profile: assessment.profile,
    provenance: a.isYou
      ? "own measurements, imports and check-ins (not simulated)"
      : "simulated",
    baselineKind: assessment.baselineKind,
    baselineDays: assessment.baselineDays,
    rawMeasurements,
    loggedSymptoms: a.attached?.loggedSymptoms,
    liveReading: a.live && {
      ...a.live,
      provenance: a.live.simulated
        ? "simulated strap, not a real measurement"
        : "measured by the attached strap",
      note: "one current value, not an average",
    },
    storedMeasurementsToday: a.attached?.storedMeasurementsToday,
    signals,
    risks: assessment.risks.map((r) => ({
      ruleId: r.ruleId,
      name: r.name,
      level: r.level,
      why: r.why,
      missing: r.missing,
      uncertainty: r.uncertainty,
    })),
  };
  // Signal keys an answer may cite; the symptom list is citable also to say that none were reported
  const citableKeys = new Set<string>([
    ...signals.map((s) => s.key),
    ...rawMeasurements.map((s) => s.key),
    ...(a.attached ? ["logged_symptoms"] : []),
    ...(a.live ? ["live_heart_rate"] : []),
  ]);
  return {
    selectedCrewContext,
    rawMeasurements,
    signals,
    hasSymptoms,
    citableKeys,
  };
}

type Generated = {
  paragraphs: { text: string; evidenceIds: string[]; signalKeys: string[] }[];
  uncertainties: string[];
  followUp: string[];
  insufficientEvidence: boolean;
};
/** True when an answer must be thrown away: unsafe wording, a link, an unknown citation, or an uncited paragraph */
export function answerRejected(
  g: Generated,
  passageIds: Set<string>,
  citableKeys: Set<string>,
) {
  const prose = [
    ...g.paragraphs.map((p) => p.text),
    ...g.uncertainties,
    ...g.followUp,
  ].join(" ");
  return (
    UNSAFE_OUTPUT.test(prose) ||
    /https?:\/\//i.test(prose) ||
    g.paragraphs.some(
      (p) =>
        p.evidenceIds.some((id) => !passageIds.has(id)) ||
        p.signalKeys.some((k) => !citableKeys.has(k)) ||
        (!g.insufficientEvidence &&
          !p.evidenceIds.length &&
          !p.signalKeys.length),
    )
  );
}
