// Medicines: schedule, dose history, onboard supply and estimated strength.
// MOCK: schedules, stock and history are demo values. The flight surgeon sets every schedule;
// HALO records what was taken and never suggests or changes a dose.

import type { Level } from "../engine/types.ts";
import { forecastPotency } from "../engine/potency.ts";

export type Category = "Supplement" | "Sleep" | "Kidney" | "Pain" | "Allergy" | "Motion sickness" | "Infection" | "Emergency";
export const CATEGORIES: Category[] = ["Supplement", "Sleep", "Kidney", "Pain", "Allergy", "Motion sickness", "Infection", "Emergency"];

export type Caution = {
  /** COUPLING_RULES id; the caution shows while that risk is at least `from` */
  ruleId: string;
  from: Exclude<Level, "Nominal">;
  text: string;
};

export type MedInfo = {
  id: string;
  name: string;
  /** What it is for, in plain words. No doses here. */
  purpose: string;
  category: Category;
  location: string;
  /** Typical label shelf life from manufacture, in months (DEMO: real values depend on the product) */
  shelfLifeMonths: number;
  /** As-needed medicines: rough uses per week, for the "lasts until" estimate */
  prnPerWeek?: number;
  note?: string;
  cautions?: Caution[];
};

export const MEDS: MedInfo[] = [
  { id: "d3", name: "Vitamin D3", purpose: "Keeps vitamin D up without sunlight", category: "Supplement", location: "Kit A, drawer 1", shelfLifeMonths: 24 },
  { id: "mel", name: "Melatonin", purpose: "Helps you fall asleep on a shifted schedule", category: "Sleep", location: "Kit A, drawer 2", shelfLifeMonths: 24 },
  { id: "kcit", name: "Potassium citrate", purpose: "Lowers the chance of kidney stones", category: "Kidney", location: "Kit A, drawer 3", shelfLifeMonths: 36 },
  {
    id: "ibu", name: "Ibuprofen", purpose: "Pain and swelling", category: "Pain", location: "Kit B, drawer 1", shelfLifeMonths: 36, prnPerWeek: 0.5,
    cautions: [{ ruleId: "kidney_stone", from: "Watch", text: "Your kidney stone risk is up. Ask your flight surgeon before taking this." }],
  },
  { id: "para", name: "Paracetamol", purpose: "Pain and fever", category: "Pain", location: "Kit B, drawer 1", shelfLifeMonths: 36, prnPerWeek: 0.5 },
  { id: "anti", name: "Antihistamine", purpose: "Allergy, itchy skin, congestion", category: "Allergy", location: "Kit B, drawer 2", shelfLifeMonths: 24, prnPerWeek: 0.3 },
  {
    id: "prom", name: "Promethazine", purpose: "Space motion sickness", category: "Motion sickness", location: "Kit B, drawer 3", shelfLifeMonths: 24, prnPerWeek: 0.1,
    note: "Causes drowsiness.",
    cautions: [{ ruleId: "cognitive_readiness", from: "Watch", text: "Your readiness is low today. Check with your flight surgeon before a spacewalk or docking." }],
  },
  { id: "amox", name: "Amoxicillin", purpose: "Bacterial infections, only when prescribed", category: "Infection", location: "Kit C, drawer 1", shelfLifeMonths: 24 },
  { id: "epi", name: "Epinephrine auto-injector", purpose: "Severe allergic reaction", category: "Emergency", location: "Kit C, front pocket", shelfLifeMonths: 18, note: "Emergency use. Follow the onboard protocol." },
];
export const MED_BY_ID = Object.fromEntries(MEDS.map((m) => [m.id, m])) as Record<string, MedInfo>;

/** One scheduled dose time. `id` is unique per crew member and time of day. */
export type Dose = { id: string; medId: string; time: string; how: string; setOnDay: number; startDay: number };

// MOCK: per-crew schedules from the flight surgeon. C2's potassium citrate starts after the day-55 fluid drop.
const D3: Dose = { id: "d3-am", medId: "d3", time: "08:00", how: "With breakfast", setOnDay: 1, startDay: 1 };
const MEL: Dose = { id: "mel-pm", medId: "mel", time: "21:30", how: "Before sleep", setOnDay: 30, startDay: 30 };
export const SCHEDULE: Record<string, Dose[]> = {
  C1: [D3],
  C2: [
    D3,
    { id: "kcit-am", medId: "kcit", time: "08:00", how: "With breakfast and a full glass of water", setOnDay: 56, startDay: 56 },
    { id: "kcit-pm", medId: "kcit", time: "20:00", how: "With dinner and a full glass of water", setOnDay: 56, startDay: 56 },
    MEL,
  ],
  C3: [D3, MEL],
};
export const scheduleOf = (crewId: string) => [...(SCHEDULE[crewId] ?? [D3])].sort((a, b) => a.time.localeCompare(b.time));
export const lastSetDay = (crewId: string) => Math.max(...scheduleOf(crewId).map((d) => d.setOnDay));

// MOCK: personal supply in each crew member's kit today. Scheduled use per day comes from the schedule.
export const STOCK: Record<string, Record<string, number>> = {
  C1: { d3: 820, mel: 60, kcit: 0, ibu: 40, para: 40, anti: 20, prom: 12, amox: 21, epi: 2 },
  C2: { d3: 812, mel: 410, kcit: 118, ibu: 38, para: 40, anti: 20, prom: 12, amox: 21, epi: 2 },
  C3: { d3: 815, mel: 395, kcit: 0, ibu: 40, para: 37, anti: 18, prom: 11, amox: 21, epi: 2 },
};

// Strength forecasts come from the potency tracker in src/engine/potency.ts.
export const HORIZON_DAY = 900; // roughly a Mars round trip
export const potencyOf = (m: MedInfo, day: number, doseSoFar_mSv: number, doseRate_mSv: number) =>
  forecastPotency({ shelfLifeDays: m.shelfLifeMonths * 30.4, day, doseSoFar_mSv, doseRate_mSv, horizonDay: HORIZON_DAY });

/** Mission day the supply runs out, or null if it lasts the horizon (or nothing is used). */
export function runsOutDay(stock: number, perDay: number, day: number): number | null {
  if (perDay <= 0) return null;
  const d = day + Math.floor(stock / perDay);
  return d > HORIZON_DAY ? null : d;
}

// ---- Dose history -------------------------------------------------------------------------------

export type DoseState = "taken" | "missed" | "skipped" | "none";

// MOCK: deterministic history (same every load). About 1 missed dose in 12, and C2 missed two
// evening potassium citrate doses around the fluid drop.
function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
}
export function pastState(crewId: string, dose: Dose, day: number): DoseState {
  if (day < dose.startDay) return "none";
  if (crewId === "C2" && dose.id === "kcit-pm" && (day === 56 || day === 57)) return "missed";
  return hash(`${crewId}:${dose.id}:${day}`) < 0.08 ? "missed" : "taken";
}

/** Share of scheduled doses taken over the last `n` days before today, 0-100, or null if none were scheduled. */
export function adherence(crewId: string, doses: Dose[], day: number, n: number): number | null {
  let due = 0;
  let taken = 0;
  for (let d = day - n; d < day; d++) {
    for (const dose of doses) {
      const st = pastState(crewId, dose, d);
      if (st === "none") continue;
      due++;
      if (st === "taken") taken++;
    }
  }
  return due ? Math.round((taken / due) * 100) : null;
}

// ---- Today ---------------------------------------------------------------------------------------

/** What the crew member did today, held in the app (not saved anywhere yet). */
export type MedDay = {
  taken: Record<string, string>; // dose id -> time taken
  skipped: Record<string, string>; // dose id -> reason
  extra: { medId: string; time: string }[]; // as-needed doses logged today
  notes: { text: string; time: string }[]; // queued for the flight surgeon
};
export const EMPTY_DAY: MedDay = { taken: {}, skipped: {}, extra: [], notes: [] };

export type TodayStatus = "Taken" | "Skipped" | "Due now" | "Overdue" | "Later";

export const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};
export const clockNow = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

/** A dose is due from an hour before its time to an hour after; later than that it is overdue. */
export function statusOf(dose: Dose, today: MedDay, now: string): TodayStatus {
  if (today.taken[dose.id]) return "Taken";
  if (today.skipped[dose.id]) return "Skipped";
  const diff = toMinutes(now) - toMinutes(dose.time);
  if (diff > 60) return "Overdue";
  if (diff >= -60) return "Due now";
  return "Later";
}

/** The next dose that still needs doing today: overdue first, then due, then the next one later. */
export function nextDose(crewId: string, today: MedDay, now: string) {
  const open = scheduleOf(crewId).map((d) => ({ dose: d, status: statusOf(d, today, now) })).filter((x) => x.status !== "Taken" && x.status !== "Skipped");
  return open.find((x) => x.status === "Overdue") ?? open.find((x) => x.status === "Due now") ?? open[0] ?? null;
}

/** "in 2 h 10 min" / "in 25 min" / "now" */
export function untilText(time: string, now: string) {
  const diff = toMinutes(time) - toMinutes(now);
  if (diff <= 0) return "now";
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  return `in ${h ? `${h} h ` : ""}${m} min`;
}
