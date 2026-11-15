import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import type { Reading, SimData } from "../../src/engine/types.ts";
import { UNITS } from "./contracts.ts";
import { Store } from "./store.ts";
export function loadDataset(
  path = fileURLToPath(new URL("../../data/crew_sim.json", import.meta.url)),
) {
  const buffer = readFileSync(path);
  if (buffer.length > 2_000_000) throw Error("Dataset too large");
  const data = JSON.parse(buffer.toString()) as SimData;
  validateDataset(data);
  return { data, sha256: createHash("sha256").update(buffer).digest("hex") };
}

/** Same checks for the bundled file and for a scenario simulated from Settings: 3 crew, days 1-120, finite values */
export function validateDataset(data: SimData) {
  if (
    data.meta.simulated !== true ||
    !Array.isArray(data.crew) ||
    !Array.isArray(data.readings) ||
    data.crew.length !== 3
  )
    throw Error("Invalid demo source");
  const ids = new Set(data.crew.map((c) => c.id));
  const seen = new Set<string>();
  for (const r of data.readings) {
    const key = `${r.crew_id}:${r.day}`;
    if (
      !ids.has(r.crew_id) ||
      !Number.isInteger(r.day) ||
      r.day < 1 ||
      r.day > 120 ||
      seen.has(key)
    )
      throw Error("Invalid crew/day coverage");
    seen.add(key);
    for (const k of Object.keys(UNITS)) {
      const n = (r as any)[k];
      if (n !== null && (typeof n !== "number" || !Number.isFinite(n)))
        throw Error("Invalid measurement");
    }
  }
  if (seen.size !== 360) throw Error("Incomplete dataset");
}
export function historyFor(
  data: SimData,
  store: Store,
  crewId: string,
): Reading[] {
  if (!data.crew.some((c) => c.id === crewId)) throw Error("Unknown astronaut");
  const logs = new Map(store.list("checkin", crewId).map((l) => [l.day, l]));
  const tests = store.list("test", crewId);
  const measured = store
    .list("measurement", crewId)
    .filter((m) => m.quality !== "invalid" && m.value != null);
  return data.readings
    .filter((r) => r.crew_id === crewId)
    .map((r) => {
      const adjusted = { ...r, ...logs.get(r.day)?.measurements };
      for (const t of tests.filter((t) => t.day === r.day)) {
        if (t.type === "reaction") adjusted.reaction_time_ms = t.average;
        if (t.type === "memory") adjusted.memory_score = t.average;
      }
      // Instrument readings (strap, file import) win over the simulator; measured beats simulated
      for (const m of measured
        .filter((m) => m.missionDay === r.day)
        .sort(
          (a, b) =>
            Number(a.provenance !== "simulated") -
            Number(b.provenance !== "simulated"),
        ))
        (adjusted as any)[m.signal] = m.value;
      return adjusted;
    });
}
