import { makeServer } from "./node/app.ts";
const app = await makeServer({ dbPath: ":memory:" });
for (const [crewId, day] of [
  ["C2", 50],
  ["C2", 60],
  ["C1", 40],
  ["C3", 70],
] as const) {
  const r = await app.inject(
    `/api/snapshot?crewId=${crewId}&day=${day}&profile=mars_transit`,
  );
  const s = r.json();
  console.log(
    JSON.stringify({
      crewId,
      day,
      priority: s.assessment.priority?.name ?? null,
      severity: s.assessment.priority?.level ?? "Nominal",
      unknown: s.assessment.unknown,
      readiness: s.readiness.status,
    }),
  );
}
await app.close();
