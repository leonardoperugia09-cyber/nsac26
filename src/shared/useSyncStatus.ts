import { useEffect, useState } from "react";
import { link, pendingCheckins } from "./api.ts";

/** Live link status for the top bar: whether the HALO server answered, how long ago, and check-ins still waiting. */
export function useSyncStatus() {
  const read = () => ({ ok: link.ok, at: link.at, pending: pendingCheckins(), now: Date.now() });
  const [s, set] = useState(read);
  useEffect(() => {
    const update = () => set(read());
    window.addEventListener("halo-sync", update);
    window.addEventListener("halo-data-change", update);
    const tick = window.setInterval(update, 30000);
    return () => { window.removeEventListener("halo-sync", update); window.removeEventListener("halo-data-change", update); window.clearInterval(tick); };
  }, []);
  return s;
}

/** "just now", "4 min ago", or the clock time after an hour */
export const ago = (at: number, now: number) => {
  const min = Math.floor((now - at) / 60000);
  return min < 1 ? "just now" : min < 60 ? `${min} min ago` : new Date(at).toTimeString().slice(0, 5);
};
