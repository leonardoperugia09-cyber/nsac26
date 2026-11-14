import { api, query, type Selection } from "./api.ts";

/** One instrument reading. Same shape as the backend's Measurement contract (plus crewId) and src/instruments/types.ts. */
export type Measurement = {
  crewId: string;
  signal: string;
  value: number;
  unit: string;
  sourceId: string;
  provenance: "measured" | "self_reported" | "estimated" | "simulated";
  observedAt?: string;
  missionDay: number;
  quality: "valid" | "suspect" | "invalid";
};
type Stored = Measurement & { pending?: boolean };

const KEY = "halo-measurements-v1";
const BATCH = 400; // the server accepts up to 500 per request
const keyOf = (m: Measurement) =>
  `${m.crewId}:${m.missionDay}:${m.signal}:${m.sourceId}`;

export function localMeasurements(): Stored[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}
function save(list: Stored[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* storage blocked: readings stay in memory for this page */
  }
}

export const pendingMeasurements = () =>
  localMeasurements().filter((m) => m.pending).length;

/** Keep readings on this device at once, then send them to the HALO server (they wait when offline). */
export async function addMeasurements(items: Measurement[]) {
  if (!items.length) return;
  const all = new Map(localMeasurements().map((m) => [keyOf(m), m]));
  for (const m of items) all.set(keyOf(m), { ...m, pending: true });
  save([...all.values()]);
  window.dispatchEvent(new Event("halo-data-change"));
  await syncMeasurements();
}

/** Send waiting readings, one crew member at a time, in batches the server accepts. */
export async function syncMeasurements() {
  const waiting = localMeasurements().filter((m) => m.pending);
  if (!waiting.length) return;
  const sent = new Set<string>();
  const crews = [...new Set(waiting.map((m) => m.crewId))];
  outer: for (const crewId of crews) {
    const mine = waiting.filter((m) => m.crewId === crewId);
    for (let i = 0; i < mine.length; i += BATCH) {
      const chunk = mine.slice(i, i + BATCH);
      try {
        await api("/measurements", {
          crewId,
          measurements: chunk.map(({ pending: _p, crewId: _c, ...m }) => m),
        });
        chunk.forEach((m) => sent.add(keyOf(m)));
      } catch {
        break outer;
      }
    }
  }
  save(
    localMeasurements().map((m) =>
      sent.has(keyOf(m)) ? { ...m, pending: false } : m,
    ),
  );
  window.dispatchEvent(new Event("halo-sync"));
}

/** Bring in readings stored on the server (from other devices); readings still waiting here win. */
export async function pullMeasurements(selection: Selection) {
  try {
    const rows = await api<(Measurement & { recordedAt?: string })[]>(
      "/measurements?" + query(selection),
    );
    const before = localMeasurements();
    const all = new Map(before.map((m) => [keyOf(m), m]));
    for (const r of rows) {
      const m: Stored = {
        crewId: r.crewId,
        signal: r.signal,
        value: r.value,
        unit: r.unit,
        sourceId: r.sourceId,
        provenance: r.provenance,
        observedAt: r.observedAt,
        missionDay: r.missionDay,
        quality: r.quality,
        pending: false,
      };
      if (!all.get(keyOf(m))?.pending) all.set(keyOf(m), m);
    }
    const after = [...all.values()];
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      save(after);
      window.dispatchEvent(new Event("halo-data-change"));
    }
  } catch {
    /* readings on this device stay available */
  }
}

/** Measured readings beat simulated ones; among equals, the latest observation wins. */
const rank = (m: Measurement) => (m.provenance === "simulated" ? 0 : 1);

/** The reading that counts for each signal on one day, for one crew member. */
export function measurementsOn(
  crewId: string,
  day: number,
): Map<string, Measurement> {
  const best = new Map<string, Measurement>();
  for (const m of localMeasurements()) {
    if (m.crewId !== crewId || m.missionDay !== day || m.quality === "invalid")
      continue;
    const cur = best.get(m.signal);
    if (
      !cur ||
      rank(m) > rank(cur) ||
      (rank(m) === rank(cur) && (m.observedAt ?? "") >= (cur.observedAt ?? ""))
    )
      best.set(m.signal, m);
  }
  return best;
}
