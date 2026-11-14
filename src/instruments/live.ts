import { useEffect, useState } from "react";
import { addMeasurements } from "../shared/measurements.ts";
import { connectHeartRate } from "./ble.ts";
import { startSimulatedStrap } from "./simulated.ts";

/** A running heart-rate source: a Bluetooth strap or the simulated strap. */
export type LiveSource = { name: string; simulated: boolean; stop(): void };
type Starter = (onBpm: (bpm: number, at: Date) => void) => Promise<{ name: string; stop(): void }> | { name: string; stop(): void };

type LiveState = { name: string | null; simulated: boolean; bpm: number | null; at: number | null; error: string | null };
let state: LiveState = { name: null, simulated: false, bpm: null, at: null, error: null };
let source: { stop(): void } | null = null;
let minute: number[] = [];
let saveTimer = 0;
let target = { crewId: "C2", day: 58 };

const emit = (patch: Partial<LiveState>) => {
  state = { ...state, ...patch };
  window.dispatchEvent(new Event("halo-live"));
};

/** Which astronaut and day live readings are saved to (follows the crew switch). */
export const setLiveTarget = (crewId: string, day: number) => { target = { crewId, day }; };

/** Every minute the average heart rate becomes today's reading for the selected astronaut. */
function saveMinute() {
  if (!minute.length || !state.name) return;
  const avg = Math.round(minute.reduce((a, b) => a + b, 0) / minute.length);
  minute = [];
  void addMeasurements([{
    crewId: target.crewId, signal: "heart_rate", value: avg, unit: "bpm", sourceId: state.name,
    provenance: state.simulated ? "simulated" : "measured", observedAt: new Date().toISOString(), missionDay: target.day, quality: "valid",
  }]);
}

/** Start a strap (from a click, for Bluetooth). Replaces any running one. */
export async function startLive(start: Starter, simulated: boolean) {
  stopLive();
  try {
    const s = await start((bpm, at) => {
      minute.push(bpm);
      emit({ bpm, at: at.getTime() });
    });
    source = s;
    emit({ name: s.name, simulated, error: null });
    saveTimer = window.setInterval(saveMinute, 60000);
  } catch (e) {
    // Closing the browser's device picker is a choice, not an error
    const cancelled = e instanceof DOMException && e.name === "NotFoundError";
    emit({ error: cancelled ? null : e instanceof Error ? e.message : "Could not connect" });
  }
}

/** Web Bluetooth exists only in Chrome and Edge on a computer. */
export const hasBluetooth = () => typeof navigator !== "undefined" && "bluetooth" in navigator;
/** Opens the browser's Bluetooth picker: call it from a click. */
export const connectStrap = () =>
  startLive((onBpm) => connectHeartRate(onBpm).then((c) => ({ name: c.name, stop: () => c.disconnect() })), false);
export const startSimulated = () => startLive((onBpm) => startSimulatedStrap(onBpm), true);

export function stopLive() {
  if (saveTimer) window.clearInterval(saveTimer);
  saveTimer = 0;
  saveMinute();
  source?.stop();
  source = null;
  emit({ name: null, simulated: false, bpm: null, at: null });
}

/** Live strap state for any screen (homepage reading, Settings card). */
export function useLive() {
  const [s, set] = useState(state);
  useEffect(() => {
    const update = () => set(state);
    window.addEventListener("halo-live", update);
    return () => window.removeEventListener("halo-live", update);
  }, []);
  return s;
}
