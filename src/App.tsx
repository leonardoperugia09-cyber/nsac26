import { useEffect, useMemo, useState } from "react";
import { Sidebar, type Page } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { DEMO_DAY, MISSION_PROFILE, SIM, crewById, historyOf, syncScenario } from "./data/crew.ts";
import { Overview } from "./pages/Overview";
import { RiskBanner } from "./components/RiskBanner";
import { buildOverview, easedToday } from "./ui/overviewData.ts";
import { addFluid, api, query, localCheckins, pullCheckins, syncCheckins } from "./shared/api.ts";
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
import { QuickCheckin } from "./components/QuickCheckin";
import { EMPTY_DAY, type MedDay } from "./ui/medicinesData.ts";
import type { RegionId } from "./bodymap/regions.ts";
import s from "./App.module.css";

const PROFILE_NAME = MISSION_PROFILE === "mars_transit" ? "Mars transit" : MISSION_PROFILE === "moon" ? "Moon surface" : "ISS";
const DELAY = MISSION_PROFILE === "mars_transit" ? "18 min" : MISSION_PROFILE === "moon" ? "1 s" : null;

const readLook = (): Look => {
  try { return localStorage.getItem("halo-look") === "plain" ? "plain" : "field"; } catch { return "field"; }
};

export default function App() {
  const [page, setPage] = useState<Page>("overview");
  const [crewId, setCrewId] = useState("C2"); // demo story: Marco Ricci
  const [day, setDay] = useState(DEMO_DAY); // "Today" from the scenario in Settings
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
  const risk = useMemo(() => buildOverview(crewId, day).risk, [crewId, day, revision]);

  // Manar's backend: send check-ins saved offline when the link is back, pull the server's copies, follow page jumps from inside pages
  useEffect(() => {
    syncScenario(); // an edited scenario on this device is mirrored to the HALO server
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
  useEffect(() => { pullCheckins({ crewId, day, profile: MISSION_PROFILE }); pullMeasurements({ crewId, day, profile: MISSION_PROFILE }); setLiveTarget(crewId, day); }, [crewId, day]);
  const [planDone, setPlanDone] = useState<Record<string, string[]>>({});
  const done = planDone[crewId] ?? [];
  const setDone = (ids: string[]) => {
    // Water steps are real intake: ticking one adds 250 ml to today's fluid, unticking takes it back
    const water = (list: string[]) => list.filter((id) => id === "water1" || id === "water2").length;
    const ml = (water(ids) - water(done)) * 250;
    if (ml) addFluid(crewId, day, ml, historyOf(crewId).find((r) => r.day === day)?.fluid_intake_ml ?? 0);
    setPlanDone((m) => ({ ...m, [crewId]: ids }));
  };
  const actRisk = risk?.level === "act" && !easedToday(risk, done) ? risk : null;

  // Leo: today's Daily Log, per crew member. The homepage asks once ("How are you doing?") until it's saved
  const [logged, setLogged] = useState<Record<string, boolean>>({});
  const [quickMood, setQuickMood] = useState<Record<string, number>>({});
  const [later, setLater] = useState<Record<string, boolean>>({});
  // Medicines taken or skipped, stored per astronaut and day on this device and on the HALO server (Manar)
  const [meds, setMeds] = useState<Record<string, MedDay>>({});
  const medKey = `${crewId}:${day}`;
  const medsToday: MedDay = meds[medKey] ?? (() => {
    try { return JSON.parse(localStorage.getItem("halo-med-day-" + medKey) ?? "null") ?? EMPTY_DAY; } catch { return EMPTY_DAY; }
  })();
  const changeMeds = (state: MedDay) => {
    setMeds((m) => ({ ...m, [medKey]: state }));
    try { localStorage.setItem("halo-med-day-" + medKey, JSON.stringify(state)); } catch { /* storage blocked: keep in memory */ }
    api("/medication-day", { crewId, day, state }).catch(() => {});
  };
  useEffect(() => {
    let cancelled = false;
    api("/medication-day?" + query({ crewId, day, profile: MISSION_PROFILE }))
      .then((r) => { if (!cancelled && r.state && !localStorage.getItem("halo-med-day-" + medKey)) setMeds((m) => ({ ...m, [medKey]: r.state })); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [crewId, day]);
  const firstName = crewById(crewId).name.split(" ").slice(-2)[0];
  const askCheckin = page === "overview" && !logged[crewId] && !later[crewId] && !localCheckins().some((l) => l.crewId === crewId && l.day === day);

  return (
    <>
      <Sidebar page={page} onNavigate={navigate} />
      <TopBar profile={MISSION_PROFILE} day={day} crew={SIM.crew} selected={crewById(crewId)}
        onSelect={setCrewId} onUrgentHelp={() => { setUrgent(true); setPage("assistant"); }} />
      <main key={`${crewId}-${day}`} className={s.main}>
        {actRisk && page !== "overview" && <RiskBanner risk={actRisk} onOpen={() => navigate("overview")} />}
        {page === "overview" && <Overview key={crewId} crewId={crewId} day={day} delay={DELAY} onOpenHealth={openHealth} done={done} onDone={setDone}
          logged={!!logged[crewId]} meds={medsToday} profileName={PROFILE_NAME} onNavigate={navigate} />}
        {page === "settings" && <Settings look={look} onLook={setLook} crewId={crewId} day={day}
          onToday={setDay} />}
        {page === "health" && <Health crewId={crewId} day={day} selected={system} onSelect={setSystem} />}
        {page === "log" && <DailyLog crewId={crewId} day={day} quickMood={quickMood[crewId] ?? null}
          onSaved={() => setLogged((m) => ({ ...m, [crewId]: true }))} />}
        {page === "assistant" && <Assistant crewId={crewId} day={day} delay={DELAY} urgent={urgent} />}
        {page === "mission" && <Mission crewId={crewId} day={day} />}
        {page === "medicines" && <Medicines crewId={crewId} day={day} delay={DELAY} today={medsToday} onChange={changeMeds} />}
        {page === "evidence" && <Evidence />}
      </main>
      {askCheckin && (
        <QuickCheckin key={`checkin-${crewId}-${day}`} name={firstName} day={day} mood={quickMood[crewId] ?? null}
          onMood={(m) => setQuickMood((q) => ({ ...q, [crewId]: m }))}
          onOpenLog={() => { setLater((l) => ({ ...l, [crewId]: true })); navigate("log"); }}
          onTalk={() => { setLater((l) => ({ ...l, [crewId]: true })); navigate("assistant"); }}
          onLater={() => setLater((l) => ({ ...l, [crewId]: true }))} />
      )}
    </>
  );
}
