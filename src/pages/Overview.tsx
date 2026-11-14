import { useMemo } from "react";
import { BodyCard } from "../components/BodyCard";
import { LatestReadings } from "../components/LatestReadings";
import { PriorityAlert } from "../components/PriorityAlert";
import { TodayTasks } from "../components/TodayTasks";
import { buildBodyMapModel } from "../bodymap/model.ts";
import { REGIONS, type RegionId } from "../bodymap/regions.ts";
import { MISSION_PROFILE, historyOf } from "../data/crew";
import { useDataRevision } from "../shared/useDataRevision.ts";
import { buildOverview } from "../ui/overviewData.ts";
import s from "./Overview.module.css";


type Props = { crewId: string; day: number; delay: string | null; onOpenHealth: (id: RegionId) => void; done: string[]; onDone: (ids: string[]) => void };

export function Overview({ crewId, day, delay, onOpenHealth, done, onDone }: Props) {
  const revision = useDataRevision();
  const m = useMemo(() => buildOverview(crewId, day), [crewId, day, revision]);
  const next = m.tasks.find((t) => !t.done);
  const flagged = useMemo(() => {
    const body = buildBodyMapModel(historyOf(crewId), day, MISSION_PROFILE);
    return REGIONS.filter((d) => body.regions[d.id].status === "watch" || body.regions[d.id].status === "act").map((d) => d.name);
  }, [crewId, day, revision]);
  return (
    <>
      <PriorityAlert risk={m.risk} series={m.series} today={day} delay={delay} nextTask={next} done={done} onDone={onDone}
        flagged={flagged} />
      <div className={s.below}>
        <TodayTasks key={crewId} initial={m.tasks} />
        <BodyCard crewId={crewId} day={day} onSelect={onOpenHealth} onOpen={(id) => onOpenHealth(id ?? "heart")} />
        <LatestReadings readings={m.readings} onAll={() => onOpenHealth("heart")} />
      </div>
    </>
  );
}
