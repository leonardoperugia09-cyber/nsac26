import { useMemo, useState } from "react";
import { BodyFigure } from "../bodymap/anatomy/BodyFigure";
import { buildBodyMapModel, type RegionModel, type RegionStatus } from "../bodymap/model.ts";
import { REGIONS, REGION_BY_ID, type RegionId, type View } from "../bodymap/regions.ts";
import { MISSION_PROFILE, historyOf } from "../data/crew";
import { useDataRevision } from "../shared/useDataRevision.ts";
import card from "./Card.module.css";
import { More } from "./More";
import { Segmented } from "./Segmented";
import s from "./BodyCard.module.css";

export const REGION_STATUS_TEXT: Record<RegionStatus, string> = { nominal: "Normal", watch: "Watch", act: "Act", unknown: "No reading", stale: "Old data" };
const isFlagged = (r: RegionModel) => r.status === "watch" || r.status === "act";

type Props = {
  crewId: string;
  day: number;
  size?: "compact" | "full";
  selected?: RegionId;
  onSelect: (id: RegionId) => void;
  onOpen?: (firstFlagged?: RegionId) => void;
};

/** Leo's front/back anatomy (src/bodymap) on a light card. Region status comes from the coupled risk engine. */
export function BodyCard({ crewId, day, size = "compact", selected, onSelect, onOpen }: Props) {
  const revision = useDataRevision();
  const model = useMemo(() => buildBodyMapModel(historyOf(crewId), day, MISSION_PROFILE), [crewId, day, revision]);
  const regions = REGIONS.map((d) => model.regions[d.id]);
  const flagged = regions.filter(isFlagged);
  const [view, setView] = useState<View>(() => (selected ? REGION_BY_ID[selected].views[0] : "anterior"));

  // Picking a region from the list turns the figure to a side that shows it
  const pick = (id: RegionId) => {
    if (!REGION_BY_ID[id].views.includes(view)) setView(REGION_BY_ID[id].views[0]);
    onSelect(id);
  };

  const rows = (items: RegionModel[]) => (
    <ul className={s.list}>
      {items.map((r) => (
        <li key={r.def.id}>
          <button className={`${s.row} ${s[r.status]} ${selected === r.def.id ? s.rowSelected : ""}`} aria-pressed={selected === r.def.id} onClick={() => pick(r.def.id)}>
            {r.def.name}<span>{REGION_STATUS_TEXT[r.status]}</span>
          </button>
        </li>
      ))}
    </ul>
  );

  return (
    <section className={`${card.card} ${s.card} ${size === "full" ? s.full : ""}`} aria-labelledby="body-title">
      <div className={card.head}>
        <h2 id="body-title">Body</h2>
        {onOpen && <button onClick={() => onOpen(flagged[0]?.def.id)}>Open Health</button>}
      </div>
      <Segmented label="Body view" value={view} onChange={setView} options={[{ id: "anterior", label: "Front" }, { id: "posterior", label: "Back" }]} />
      <div className={s.layout}>
        <div key={view} className={s.figure}>
          <BodyFigure view={view} model={model} selected={selected ?? null} linked={null} onSelect={(id) => onSelect(id)} hidden={["whole_body"]} />
        </div>
        <div className={s.side}>
          {size === "full" ? rows(regions) : (
            <>
              {flagged.length ? rows(flagged) : <p className={s.hint}>Everything is inside your normal.</p>}
              <More label={`All ${regions.length} regions`}>{rows(regions.filter((r) => !isFlagged(r)))}</More>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
