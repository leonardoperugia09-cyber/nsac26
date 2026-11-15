// Client for the HALO backend (FastAPI, backend/). If the backend is off or slow, every call
// returns null and the caller uses the local mock answer, so the demo never breaks.

import { historyOf, readingOn, crewById, MISSION_PROFILE } from "../data/crew.ts";
import { driftOn } from "../ui/systems.ts";
import { evaluateRisks } from "../engine/risks.ts";

const BASE = (import.meta.env.VITE_HALO_API_URL as string | undefined) ?? "http://localhost:8000/api/v1";

export type EvidenceNote = { id: string; topic: string; note: string; source: string; url: string };
export type AssistantReply = {
  kind: "emergency" | "answer";
  source: "red_flag_rules" | "ai_model" | "rule_based_fallback";
  text: string;
  redFlags: { id: string; title: string; steps: string[] }[];
  evidence: EvidenceNote[];
  escalate: string;
  signalDelay: string;
  disclaimer: string;
};

/** Everything the server needs about this astronaut today, built from the browser engine. */
export function buildContext(crewId: string, day: number) {
  const reading = readingOn(crewId, day);
  const drift = Object.values(driftOn(crewId, day))
    .filter((d) => d.status !== "inside band")
    .map((d) => ({ label: d.label, value: d.value, bandLo: d.bandLo, bandHi: d.bandHi, status: d.status }));
  const risks = evaluateRisks(historyOf(crewId), day, MISSION_PROFILE)
    .filter((r) => r.level !== "Nominal")
    .map((r) => ({ name: r.name, level: r.level, why: r.why, actions: [r.action], escalate: "" }));
  return {
    crew_name: crewById(crewId).name,
    day,
    mission_profile: MISSION_PROFILE,
    reading: reading ? { ...reading, events: undefined } : {},
    drift,
    risks,
  };
}

async function post<T>(path: string, body: unknown, ms = 25000): Promise<T | null> {
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(ms),
    });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

export const askHalo = (message: string, crewId: string, day: number, history: { role: "user" | "assistant"; content: string }[] = []) =>
  post<AssistantReply>("/assistant", { message, history, context: buildContext(crewId, day) });

export const draftReportRemote = (crewId: string, day: number, complaint: string) =>
  post<{ report: string; sent: false }>("/report", { context: buildContext(crewId, day), complaint }, 8000);
