import { useMemo } from "react";
import { BodyCard } from "../components/BodyCard";
import { LatestReadings } from "../components/LatestReadings";
import { QuickLinks, type QuickLink } from "../components/QuickLinks";
import type { Page } from "../components/Sidebar";
import { PriorityAlert } from "../components/PriorityAlert";
import { TodayTasks } from "../components/TodayTasks";
import { buildBodyMapModel } from "../bodymap/model.ts";
import { REGIONS, type RegionId } from "../bodymap/regions.ts";
import { MISSION_PROFILE, contextOf, historyOf } from "../data/crew";
import { useDataRevision } from "../shared/useDataRevision.ts";
import { buildOverview } from "../ui/overviewData.ts";
import { MED_BY_ID, clockNow, nextDose, type MedDay } from "../ui/medicinesData.ts";
import { joinAnd } from "../ui/text.ts";
import s from "./Overview.module.css";


type Props = {
  crewId: string; day: number; delay: string | null; onOpenHealth: (id: RegionId) => void; done: string[]; onDone: (ids: string[]) => void;
  logged: boolean; meds: MedDay; profileName: string; onNavigate: (p: Page) => void;
};

export function Overview({ crewId, day, delay, onOpenHealth, done, onDone, logged, meds, profileName, onNavigate }: Props) {
  const revision = useDataRevision();
  const m = useMemo(() => buildOverview(crewId, day), [crewId, day, revision]);
  const next = m.tasks.find((t) => !t.done);
  const body = useMemo(() => buildBodyMapModel(historyOf(crewId), day, MISSION_PROFILE, contextOf(crewId, day)), [crewId, day, revision]);
  const flaggedDefs = REGIONS.filter((d) => body.regions[d.id].status === "watch" || body.regions[d.id].status === "act");
  const flagged = flaggedDefs.map((d) => d.name);
  const anyAct = flaggedDefs.some((d) => body.regions[d.id].status === "act");
  const dose = nextDose(crewId, meds, clockNow());

  const links: QuickLink[] = [
    { id: "log", label: "Daily Log", status: logged ? `Done for Day ${day}` : "Not done today", tone: logged ? "done" : "watch", onOpen: () => onNavigate("log") },
    {
      id: "health", label: "Body systems",
      status: flagged.length ? `${joinAnd(flagged.slice(0, 2))}${flagged.length > 2 ? ` +${flagged.length - 2}` : ""}` : "No measured region flagged",
      tone: anyAct ? "act" : flagged.length ? "watch" : undefined,
      onOpen: () => onOpenHealth(flaggedDefs[0]?.id ?? "heart"),
    },
    {
      id: "medicines", label: "Medicines",
      status: dose ? `${MED_BY_ID[dose.dose.medId].name} ${dose.status === "Overdue" ? "overdue" : dose.status === "Due now" ? "due now" : `at ${dose.dose.time}`}` : "Today's doses done",
      tone: dose?.status === "Overdue" ? "act" : dose?.status === "Due now" ? "watch" : dose ? undefined : "done",
      onOpen: () => onNavigate("medicines"),
    },
    { id: "assistant", label: "Assistant", status: "Ask HALO anything", onOpen: () => onNavigate("assistant") },
    { id: "mission", label: "Mission", status: `Day ${day}, ${profileName}`, onOpen: () => onNavigate("mission") },
  ];

  return (
    <>
      <PriorityAlert risk={m.risk} series={m.series} today={day} delay={delay} nextTask={next} done={done} onDone={onDone}
        flagged={flagged} />
      <QuickLinks links={links} />
      <div className={s.below}>
        <TodayTasks key={crewId} initial={m.tasks} />
        <BodyCard crewId={crewId} day={day} onSelect={onOpenHealth} onOpen={(id) => onOpenHealth(id ?? "heart")} />
        <LatestReadings readings={m.readings} onAll={() => onOpenHealth("heart")} />
      </div>
    </>
  );
}
