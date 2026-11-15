import { contextOf } from "../data/crew";
import { useMemo } from "react";
import { BookOpen } from "@phosphor-icons/react";
import { BodyCard, REGION_STATUS_TEXT } from "../components/BodyCard";
import { PageHero } from "../components/PageHero";
import { joinAnd } from "../ui/text.ts";
import { SignalTrend } from "../components/SignalTrend";
import { SleepCard } from "../components/SleepCard";
import { buildBodyMapModel } from "../bodymap/model.ts";
import { REGIONS, type RegionId } from "../bodymap/regions.ts";
import { MISSION_PROFILE, historyOf } from "../data/crew";
import { useDataRevision } from "../shared/useDataRevision.ts";
import card from "../components/Card.module.css";
import s from "./Health.module.css";

type Props = { crewId: string; day: number; selected: RegionId | null; onSelect: (id: RegionId) => void };

/** Each body region in detail: Leo's map on the left, the selected region's linked risks and signals on the right. */
export function Health({ crewId, day, selected, onSelect }: Props) {
  const revision = useDataRevision();
  const model = useMemo(() => buildBodyMapModel(historyOf(crewId), day, MISSION_PROFILE, contextOf(crewId, day)), [crewId, day, revision]);
  const worst = (st: string) => REGIONS.find((d) => model.regions[d.id].status === st)?.id;
  const sel: RegionId = selected ?? worst("act") ?? worst("watch") ?? "heart";
  const r = model.regions[sel];
  const risks = r.risks.filter((x) => x.level !== "Nominal");
  const level = model.overall === "act" ? "act" : model.overall === "watch" ? "watch" : "normal";
  const flagged = REGIONS.filter((d) => ["watch", "act"].includes(model.regions[d.id].status)).map((d) => d.name.toLowerCase());
  const title = flagged.length
    ? `${joinAnd(flagged).replace(/^./, (c) => c.toUpperCase())} need${flagged.length === 1 ? "s" : ""} attention`
    : "No measured region is flagged; review missing inputs";
  const linked = model.risks.filter((x) => x.level !== "Nominal");

  return (
    <>
      <PageHero page="Health" state={level} title={title}
        line={linked.length
          ? <>Linked risks: {linked.map((x, i) => <span key={x.ruleId}>{i ? ", " : ""}{x.name} <b className={x.level === "Act" ? s.actWord : s.watchWord}>{x.level}</b></span>)}.</>
          : "No linked risks are rising."} />
      <div className={s.grid}>
        <div className={s.map}>
          <BodyCard key={crewId} size="full" crewId={crewId} day={day} selected={sel} onSelect={onSelect} />
          <SleepCard crewId={crewId} day={day} onOpen={() => onSelect("brain")} />
        </div>
        <div key={sel} className={s.panel}>
          <header className={s.head}>
            <div className={s.nameRow}>
              <h2 className={s.name}>{r.def.name}</h2>
              <span className={`${s.status} ${s[r.status]}`}>{REGION_STATUS_TEXT[r.status]}</span>
            </div>
            {risks.map((x) => (
              <p key={x.ruleId} className={`${s.risk} ${x.level === "Act" ? s.act : s.watch}`}><b>{x.name}: {x.level}.</b> {x.action}</p>
            ))}
            <h3 className={s.whyTitle}>Why this matters in space</h3>
            <p className={s.why}>{r.def.whySpace}</p>
            <p className={s.source}><BookOpen size={16} aria-hidden />{r.def.sources.join("; ")}</p>
          </header>
          {r.def.signalIds.length === 0 ? (
            <div className={card.card}>
              <p className={s.emptyTitle}>Not measured directly.</p>
              <p className={s.emptyText}>{r.def.plainExplanation}</p>
            </div>
          ) : (
            r.def.signalIds.map((k) => <SignalTrend key={`${crewId}-${k}`} crewId={crewId} day={day} signal={k} />)
          )}
        </div>
      </div>
    </>
  );
}
