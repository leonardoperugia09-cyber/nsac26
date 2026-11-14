import { useEffect, useMemo, useState } from "react";
import { Sidebar, type Page } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { DEMO_DAY, MISSION_PROFILE, SIM, crewById } from "./data/crew.ts";
import { Overview } from "./pages/Overview";
import { RiskBanner } from "./components/RiskBanner";
import { buildOverview, easedToday } from "./ui/overviewData.ts";
import { pullCheckins, syncCheckins } from "./shared/api.ts";
import { pullMeasurements, syncMeasurements } from "./shared/measurements.ts";
import { setLiveTarget } from "./instruments/live.ts";
import { useDataRevision } from "./shared/useDataRevision.ts";
import { Health } from "./pages/Health";
import { DailyLog } from "./pages/DailyLog";
import { Assistant } from "./pages/Assistant";
import { Mission } from "./pages/Mission";
import { Medicines } from "./pages/Medicines";
import { Evidence } from "./pages/Evidence";
import { Settings, type Look } from "./pages/Settings";
import type { RegionId } from "./bodymap/regions.ts";
import s from "./App.module.css";

const DELAY = MISSION_PROFILE === "mars_transit" ? "18 min" : MISSION_PROFILE === "moon" ? "1 s" : null;

const readLook = (): Look => {
  try { return localStorage.getItem("halo-look") === "plain" ? "plain" : "field"; } catch { return "field"; }
};

export default function App() {
  const [page, setPage] = useState<Page>("overview");
  const [crewId, setCrewId] = useState("C2"); // demo story: Marco Ricci
  const [look, setLook] = useState<Look>(readLook);
  const [system, setSystem] = useState<RegionId | null>(null);
  const [urgent, setUrgent] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.look = look;
    try { localStorage.setItem("halo-look", look); } catch { /* storage blocked: keep in memory */ }
  }, [look]);

  const openHealth = (id: RegionId) => { setSystem(id); setPage("health"); };
  const navigate = (p: Page) => { setUrgent(false); setPage(p); };
  const revision = useDataRevision();
  const risk = useMemo(() => buildOverview(crewId, DEMO_DAY).risk, [crewId, revision]);

  // Manar's backend: send check-ins saved offline when the link is back, pull the server's copies, follow page jumps from inside pages
  useEffect(() => {
    syncCheckins();
    syncMeasurements();
    window.addEventListener("online", syncCheckins);
    window.addEventListener("online", syncMeasurements);
    const go = (e: Event) => setPage((e as CustomEvent<Page>).detail);
    const urgentHelp = () => { setUrgent(true); setPage("assistant"); }; // same as the top bar's Urgent help
    window.addEventListener("halo-navigate", go);
    window.addEventListener("halo-urgent", urgentHelp);
    return () => { window.removeEventListener("online", syncCheckins); window.removeEventListener("online", syncMeasurements); window.removeEventListener("halo-navigate", go); window.removeEventListener("halo-urgent", urgentHelp); };
  }, []);
  useEffect(() => { pullCheckins({ crewId, day: DEMO_DAY, profile: MISSION_PROFILE }); pullMeasurements({ crewId, day: DEMO_DAY, profile: MISSION_PROFILE }); setLiveTarget(crewId, DEMO_DAY); }, [crewId]);
  const [planDone, setPlanDone] = useState<Record<string, string[]>>({});
  const done = planDone[crewId] ?? [];
  const setDone = (ids: string[]) => setPlanDone((m) => ({ ...m, [crewId]: ids }));
  const actRisk = risk?.level === "act" && !easedToday(risk, done) ? risk : null;

  return (
    <>
      <Sidebar page={page} onNavigate={navigate} />
      <TopBar profile={MISSION_PROFILE} day={DEMO_DAY} crew={SIM.crew} selected={crewById(crewId)}
        onSelect={setCrewId} onUrgentHelp={() => { setUrgent(true); setPage("assistant"); }} />
      <main key={crewId} className={s.main}>
        {actRisk && page !== "overview" && <RiskBanner risk={actRisk} onOpen={() => navigate("overview")} />}
        {page === "overview" && <Overview key={crewId} crewId={crewId} day={DEMO_DAY} delay={DELAY} onOpenHealth={openHealth} done={done} onDone={setDone} />}
        {page === "settings" && <Settings look={look} onLook={setLook} crewId={crewId} day={DEMO_DAY} />}
        {page === "health" && <Health crewId={crewId} day={DEMO_DAY} selected={system} onSelect={setSystem} />}
        {page === "log" && <DailyLog crewId={crewId} day={DEMO_DAY} />}
        {page === "assistant" && <Assistant crewId={crewId} day={DEMO_DAY} delay={DELAY} urgent={urgent} />}
        {page === "mission" && <Mission crewId={crewId} day={DEMO_DAY} />}
        {page === "medicines" && <Medicines crewId={crewId} day={DEMO_DAY} />}
        {page === "evidence" && <Evidence />}
      </main>
    </>
  );
}
