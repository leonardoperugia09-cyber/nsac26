import { contextOf } from "../data/crew.ts";
import { useEffect, useState } from "react";
import { api, query, type Selection } from "../shared/api.ts";
import { readiness } from "../engine/assessment.ts";
import { historyOf } from "../data/crew.ts";
import s from "../shared/Workbench.module.css";
export function BackendTools({
  crewId,
  day,
  profile = "mars_transit",
}: Selection) {
  const selected = { crewId, day, profile };
  const ready = readiness(
    historyOf(crewId),
    day,
    profile,
    contextOf(crewId, day),
  );
  const [outbox, setOutbox] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const [approved, setApproved] = useState(false);
  const [fluid, setFluid] = useState(1800);
  const [scenario, setScenario] = useState<any>(null);
  const [radiation, setRadiation] = useState<any>(null);
  const [crew, setCrew] = useState<any[]>([]);
  const delay = profile === "mars_transit" ? 1200 : profile === "moon" ? 1 : 0;
  async function refresh() {
    try {
      setOutbox(await api("/outbox?" + query(selected)));
    } catch {
      const rows = JSON.parse(localStorage.getItem("halo-outbox") ?? "[]");
      setOutbox(
        rows
          .filter((r: any) => r.crewId === crewId)
          .map((r: any) => ({
            ...r,
            status:
              Date.now() >= Date.parse(r.arrivalAt)
                ? "delivered_simulated"
                : "queued_simulated",
          })),
      );
    }
  }
  useEffect(() => {
    refresh();
    api("/crew-overview?" + query(selected))
      .then((r) => setCrew(r.crew))
      .catch(() => setCrew([]));
    api("/radiation")
      .then(setRadiation)
      .catch(() => setRadiation(null));
    const timer = setInterval(refresh, 5000);
    return () => clearInterval(timer);
  }, [crewId, day, profile]);
  async function queue() {
    if (!approved) return;
    try {
      const report = await api("/reports/draft", {
        ...selected,
        purpose: "risk_review",
      });
      await api("/reports/queue", {
        reportId: report.id,
        approved: true,
        delaySeconds: delay,
        idempotencyKey: crypto.randomUUID(),
      });
      setMessage(
        "Approved report queued in the simulator. Nothing transmitted.",
      );
    } catch {
      const rows = JSON.parse(localStorage.getItem("halo-outbox") ?? "[]");
      rows.push({
        id: crypto.randomUUID(),
        crewId,
        day,
        summary: ready,
        arrivalAt: new Date(Date.now() + delay * 1000).toISOString(),
        approved: true,
        transmitted: false,
      });
      localStorage.setItem("halo-outbox", JSON.stringify(rows));
      setMessage("Saved to on-device simulated outbox. Nothing transmitted.");
    }
    refresh();
  }
  async function simulate() {
    try {
      setScenario(
        await api("/what-if", {
          ...selected,
          horizon: 7,
          changes: { fluid_intake_ml: fluid },
        }),
      );
    } catch {
      setScenario({
        assumptions:
          "Backend unavailable. Your real demo history has not changed.",
      });
    }
  }
  return (
    <>
      <h2 className={s.title}>Backend report and simulation tools</h2>
      <p className={s.intro}>
        Transparent demonstration readiness and simulated Earth communication.
        No operational clearance.
      </p>
      <div className={s.grid}>
        <section className={s.panel}>
          <h2>Readiness: {ready.status}</h2>
          <ul>
            {ready.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          <p>
            Inputs: sleep, reaction time, radiation. Demo drift ≥2: Caution; ≥3
            or radiation Act: No-go. Missing inputs: Insufficient data.
          </p>
          <p className={s.notice}>
            {ready.limitation} A flight-authorized person must approve the task.
          </p>
        </section>
        <section className={s.panel}>
          <h2>Flight-surgeon report simulator</h2>
          <p>
            Configured one-way delay: {delay} seconds. Actual response time is
            unknown.
          </p>
          <label>
            <input
              type="checkbox"
              checked={approved}
              onChange={(e) => setApproved(e.target.checked)}
            />
            I reviewed and approve queuing this demo snapshot
          </label>
          <div className={s.row}>
            <button className={s.button} disabled={!approved} onClick={queue}>
              Draft and queue demo report
            </button>
          </div>
          <p role="status">{message}</p>
          <ul>
            {outbox.map((q) => (
              <li key={q.id}>
                {q.status} · arrival {q.arrivalAt} · transmitted: false
              </li>
            ))}
          </ul>
        </section>
        <section className={s.panel}>
          <h2>What-if exploration</h2>
          <label className={s.field}>
            Scenario daily fluid intake (mL)
            <input
              type="number"
              min="0"
              max="10000"
              value={fluid}
              onChange={(e) => setFluid(Number(e.target.value))}
            />
          </label>
          <button className={s.secondary} onClick={simulate}>
            Explore 7 simulated days
          </button>
          {scenario && (
            <div className={s.result}>
              {scenario.scenario?.priority?.name ?? "No active demo pattern"}
              <p>{scenario.assumptions}</p>
            </div>
          )}
        </section>
        <section className={s.panel}>
          <h2>Crew overview</h2>
          {crew.length ? (
            crew.map((c) => (
              <p key={c.crewId}>
                {c.crewId}:{" "}
                {c.assessment.priority?.name ?? "No active demo pattern"} ·{" "}
                {c.assessment.priority?.level ?? "Nominal"} ·{" "}
                {c.assessment.unknown.length} unknown patterns
              </p>
            ))
          ) : (
            <p>
              Crew overview requires the local backend. Individual on-device
              analysis remains available.
            </p>
          )}
        </section>
        <section className={s.panel}>
          <h2>NASA instrument snapshot</h2>
          {radiation ? (
            <>
              <p>
                {radiation.status} · {radiation.snapshot.value}{" "}
                {radiation.snapshot.unit}
              </p>
              <p>
                Observed {radiation.snapshot.observed_at} at{" "}
                {radiation.snapshot.location}
              </p>
              <p className={s.notice}>{radiation.notice}</p>
            </>
          ) : (
            <p>Backend unavailable; no live radiation reading inferred.</p>
          )}
        </section>
      </div>
    </>
  );
}
