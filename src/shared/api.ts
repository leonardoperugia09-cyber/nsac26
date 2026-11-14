import type { MissionProfile } from "../engine/types.ts";
export type Selection = {
  crewId: string;
  day: number;
  profile: MissionProfile;
};
/** Last contact with the HALO server, shown in the top bar instead of a fixed "synced" text */
export const link: { ok: boolean | null; at: number | null } = { ok: null, at: null };
const markLink = (ok: boolean) => {
  link.ok = ok;
  if (ok) link.at = Date.now();
  window.dispatchEvent(new Event("halo-sync"));
};
export const pendingCheckins = () => localCheckins().filter((l) => l.pending).length;
export async function api<T = any>(path: string, body?: unknown): Promise<T> {
  const token = sessionStorage.getItem("halo-api-token");
  let response: Response;
  try {
    response = await fetch("/api" + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(16000),
  });
  } catch (e) {
    markLink(false);
    throw e;
  }
  // Any reply from the server (even a validation error) means the link works; 404/5xx means no HALO server here
  markLink(response.status < 500 && response.status !== 404);
  if (!response.ok)
    throw Error(
      response.status === 401
        ? "Backend token required: enter it in Settings."
        : `Backend request failed (${response.status})`,
    );
  return response.json();
}
export const query = (s: Selection) =>
  new URLSearchParams({
    crewId: s.crewId,
    day: String(s.day),
    profile: s.profile,
  }).toString();
export function localCheckins(): any[] {
  try {
    return JSON.parse(localStorage.getItem("halo-checkins-v1") ?? "[]");
  } catch {
    return [];
  }
}
export function rememberCheckin(log: any) {
  const logs = localCheckins().filter(
    (l) => l.crewId !== log.crewId || l.day !== log.day,
  );
  logs.push(log);
  localStorage.setItem("halo-checkins-v1", JSON.stringify(logs));
  window.dispatchEvent(new Event("halo-data-change"));
}
export async function syncCheckins() {
  const saved = new Map<string, string>();
  for (const log of localCheckins())
    if (log.pending) {
      try {
        await api("/checkins", {
          crewId: log.crewId,
          day: log.day,
          measurements: log.measurements,
          ...(log.symptoms ? { symptoms: log.symptoms } : {}),
          ...(log.vision_score ? { vision_score: log.vision_score } : {}),
        });
        saved.set(`${log.crewId}:${log.day}`, JSON.stringify(log));
      } catch {
        break;
      }
    }
  const updated = localCheckins().map((l) =>
    saved.get(`${l.crewId}:${l.day}`) === JSON.stringify(l)
      ? { ...l, pending: false }
      : l,
  );
  localStorage.setItem("halo-checkins-v1", JSON.stringify(updated));
  window.dispatchEvent(new Event("halo-sync"));
}
export async function pullCheckins(selection: Selection) {
  try {
    const rows = await api<any[]>("/checkins?" + query(selection));
    const before = localCheckins();
    const merged = new Map(before.map((l) => [`${l.crewId}:${l.day}`, l]));
    for (const r of rows) {
      const key = `${r.crewId}:${r.day}`;
      if (!merged.get(key)?.pending) merged.set(key, { ...r, pending: false });
    }
    const after = Array.from(merged.values());
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      localStorage.setItem("halo-checkins-v1", JSON.stringify(after));
      window.dispatchEvent(new Event("halo-data-change"));
    }
  } catch {
    /* on-device data remains available */
  }
}
