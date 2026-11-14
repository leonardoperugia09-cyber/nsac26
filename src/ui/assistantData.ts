// MOCK: scripted conversation and local responder, used when the HALO server is unreachable.
// Red-flag rules run first and deterministically (shared/triage.ts), then medicine words, then scripted answers.
import { triage, MEDICATION_TEXT } from "../shared/triage.ts";

export type Block =
  | { kind: "text"; text: string }
  | { kind: "check"; text: string }
  | { kind: "evidence" }
  | { kind: "action"; text: string }
  | { kind: "escalation"; text?: string }
  | { kind: "quick"; options: string[] }
  | { kind: "note" }
  | { kind: "emergency"; title: string; text: string }
  | { kind: "sources"; titles: string[] }
  | { kind: "pending" }
  | { kind: "via"; text: string };

export type HaloMessage = { id: string; from: "halo"; blocks: Block[] };
export type UserMessage = { id: string; from: "user"; text: string };
export type Message = HaloMessage | UserMessage;

export const SEED_C2: Message[] = [
  { id: "s1", from: "user", text: "I've had a dull ache in my lower back since this morning." },
  { id: "s2", from: "halo", blocks: [
    { kind: "check", text: "I checked for emergency signs first: no fever logged, no blood in urine reported, and the pain isn't described as severe. No red flags." },
    { kind: "text", text: "A few questions so I can narrow it down:" },
    { kind: "quick", options: ["One side only", "Both sides", "It hurts when I pee"] },
  ] },
  { id: "s3", from: "user", text: "One side only" },
  { id: "s4", from: "halo", blocks: [
    { kind: "text", text: "That fits with what your data shows, but it's not a diagnosis." },
    { kind: "evidence" },
    { kind: "text", text: "Low fluid plus extra salt is how kidney stones start in microgravity (Siew et al. 2024)." },
    { kind: "action", text: "What to do now: drink 500 ml over the next hour, and log your urine colour tonight." },
    { kind: "escalation" },
    { kind: "note" },
  ] },
  { id: "s5", from: "user", text: "Can I take ibuprofen for it?" },
  { id: "s6", from: "halo", blocks: [
    { kind: "text", text: "I can't advise on medicines or doses. Your flight surgeon's schedule is in Medicines, and I've added your question to the note for Houston." },
  ] },
];

export const EMPTY_QUICK = ["I have a headache", "My vision is blurry", "I slept badly"];

export const NOTE_TEXT =
  "Crew member reports a dull one-sided lower back ache since this morning. Fluid intake and urine colour are outside the usual range, sodium is high. No fever or blood in urine reported. Asked about ibuprofen; no advice given. Please advise.";

let counter = 0;
const nextId = () => `m${Date.now()}-${counter++}`;

export const EMERGENCY_TEXT = "Follow the onboard emergency protocol now. Your crew medical officer should be with you.";

// Safety rules run first, on board, before any server or AI call. null = no rule matched.
export function safetyReply(text: string): Block[] | null {
  if (triage(text).urgent) return [{ kind: "emergency", title: "This could be an emergency", text: EMERGENCY_TEXT }];
  if (MEDICATION_TEXT.test(text)) {
    return [{ kind: "text", text: "I can't advise on medicines or doses. Your flight surgeon's schedule is in Medicines, and I've added your question to the note for Houston." }];
  }
  return null;
}

// MOCK scripted answers for the replies the start screen offers. null = no script for this text.
export const userMsg = (text: string): UserMessage => ({ id: nextId(), from: "user", text });
export const haloMsg = (blocks: Block[]): HaloMessage => ({ id: nextId(), from: "halo", blocks });
