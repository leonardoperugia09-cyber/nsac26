import { contextOf } from "../data/crew";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Minus, Plus } from "@phosphor-icons/react";
import { MISSION_PROFILE, SIM, crewById, historyOf } from "../data/crew.ts";
import { Segmented } from "../components/Segmented";
import { BodyFigure } from "./anatomy/BodyFigure";
import { buildBodyMapModel, STALE_AFTER_DAYS, type RegionStatus } from "./model.ts";
import { REGIONS, REGION_BY_ID, regionsForRisk, type RegionId, type View } from "./regions.ts";
import { RegionPanel, StatusIcon } from "./RegionPanel";
import s from "./BodyMapPage.module.css";

const VIEWS: { id: View; label: string }[] = [
  { id: "anterior", label: "Front" },
  { id: "posterior", label: "Back" },
];
const MISSION_NAME = { mars_transit: "Mars transit", moon: "Moon surface", iss: "ISS" } as const;
const LAST_DAY = Math.max(...SIM.readings.map((r) => r.day));
const RANK: Record<RegionStatus, number> = { nominal: 0, unknown: 1, stale: 2, watch: 3, act: 4 };

function useMedia(query: string) {
  const [match, setMatch] = useState(() => typeof window !== "undefined" && window.matchMedia(query).matches);
  useEffect(() => {
    const m = window.matchMedia(query);
    const on = () => setMatch(m.matches);
    on();
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, [query]);
  return match;
}

type Props = { crewId: string; day: number };

/** Interactive anatomical body map. All risk levels come from the coupled risk engine via buildBodyMapModel. */
export function BodyMapPage({ crewId, day: today }: Props) {
  const [day, setDay] = useState(today);
  const [view, setView] = useState<View>("anterior");
  const [selected, setSelected] = useState<RegionId | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null);
  const wide = useMedia("(min-width: 1280px)");
  const sheet = useMedia("(max-width: 767px)");
  const trigger = useRef<Element | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => setDay(today), [today]);

  const crew = crewById(crewId);
  const model = useMemo(() => buildBodyMapModel(historyOf(crewId), day, MISSION_PROFILE, contextOf(crewId,day)), [crewId, day]);

  // Panel shows the selected region; on desktop default to the most urgent one
  const worst = useMemo(
    () => [...REGIONS].sort((a, b) => RANK[model.regions[b.id].status] - RANK[model.regions[a.id].status])[0].id,
    [model],
  );
  const shown: RegionId | null = selected ?? (sheet ? null : worst);
  const linked = useMemo(() => (highlight ? new Set(regionsForRisk(highlight)) : null), [highlight]);
  const highlightRisk = highlight ? model.risks.find((r) => r.ruleId === highlight) : undefined;

  const active = model.risks.filter((r) => r.level !== "Nominal");
  const views: View[] = wide ? ["anterior", "posterior"] : [view];

  const select = (id: RegionId, el?: Element | null) => {
    trigger.current = el ?? (document.activeElement as Element | null);
    setSelected(id);
    // a region only on the other side: flip the single view so the selection is visible
    if (!wide && !REGION_BY_ID[id].views.includes(view)) setView(REGION_BY_ID[id].views[0]);
  };
  const closeSheet = () => {
    setSelected(null);
    const el = trigger.current as HTMLElement | SVGElement | null;
    requestAnimationFrame(() => el?.focus?.());
  };

  // Bottom sheet: focus it on open, Esc closes and returns focus to the region
  useEffect(() => {
    if (!sheet || !selected) return;
    sheetRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeSheet(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet, selected]);

  const overallText =
    model.overall === "act"
      ? `Act · ${active.filter((r) => r.level === "Act").length} coupled risk${active.filter((r) => r.level === "Act").length === 1 ? "" : "s"}`
      : model.overall === "watch"
        ? `Watch · ${active.length} coupled risk${active.length === 1 ? "" : "s"} or drifting signals`
        : "Nominal · no coupled risk above Nominal";

  const panel = shown && (
    <RegionPanel
      region={model.regions[shown]}
      profile={MISSION_PROFILE}
      highlight={highlight}
      onHighlight={setHighlight}
      titleId={titleId}
      onClose={sheet ? closeSheet : undefined}
    />
  );

  return (
    <div className={s.page}>
      {/* Top: crew, mission, overall status */}
      <header className={s.top}>
        <div>
          <p className={s.eyebrow}>Body map</p>
          <h1 className={s.h1}>{crew.name}</h1>
          <p className={s.crewLine}>
            {crew.name.includes(crew.role) ? "" : `${crew.role} · `}{MISSION_NAME[MISSION_PROFILE]} · <span className="mono">Day {day}</span>
          </p>
        </div>
        <div className={s.topRight}>
          <p className={`${s.overall} ${s[model.overall]}`} role="status">
            <StatusIcon status={model.overall} size={18} /> {overallText}
          </p>
          <p className={s.sim}>SIMULATED DATA · demo thresholds · not a medical device</p>
          <div className={s.dayCtl} role="group" aria-label="Mission day (demo)">
            <button type="button" onClick={() => setDay((d) => Math.max(1, d - 1))} aria-label="Previous day"><Minus size={16} aria-hidden /></button>
            <input type="range" min={1} max={LAST_DAY} value={day} onChange={(e) => setDay(Number(e.target.value))} aria-label="Mission day" />
            <button type="button" onClick={() => setDay((d) => Math.min(LAST_DAY, d + 1))} aria-label="Next day"><Plus size={16} aria-hidden /></button>
            {day !== today && <button type="button" className={s.reset} onClick={() => setDay(today)}>Back to day {today}</button>}
          </div>
        </div>
      </header>

      <div className={`${s.layout} ${wide ? s.wide : ""}`}>
        {/* Centre: the body */}
        <section className={s.stage} aria-label="Body">
          <div className={s.stageBar}>
            {!wide && <Segmented label="Body view" options={VIEWS} value={view} onChange={setView} />}
            {highlightRisk && (
              <p className={s.highlight} role="status">
                <span><b>{highlightRisk.name}</b> ({highlightRisk.level}) · one mechanism in {regionsForRisk(highlightRisk.ruleId).map((r) => REGION_BY_ID[r].name).join(", ")}</span>
                <button type="button" onClick={() => setHighlight(null)}>Clear</button>
              </p>
            )}
          </div>
          <div className={s.figures}>
            {views.map((v) => (
              <figure key={v} className={s.fig}>
                <BodyFigure view={v} model={model} selected={shown} linked={linked} onSelect={select} />
                <figcaption className={s.caption}>{v === "anterior" ? "Anterior · front" : "Posterior · back"}</figcaption>
              </figure>
            ))}
          </div>
          {/* Text version of the map */}
          <ul className={s.index} aria-label="Body regions">
            {REGIONS.map((r) => {
              const m = model.regions[r.id];
              const dim = linked && !linked.has(r.id);
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    className={`${s.chip} ${s[m.status]} ${shown === r.id ? s.chipOn : ""} ${dim ? s.chipDim : ""}`}
                    aria-pressed={shown === r.id}
                    aria-label={m.ariaLabel}
                    onClick={(e) => select(r.id, e.currentTarget)}
                  >
                    <StatusIcon status={m.status} size={14} /> {r.name}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Right: region details (bottom sheet on phones) */}
        {!sheet && <aside className={s.side} aria-labelledby={titleId}>{panel}</aside>}
      </div>

      {/* Bottom: legend */}
      <footer className={s.legend} aria-label="Legend">
        <span className={s.lg}><svg viewBox="0 0 20 12" aria-hidden><rect x="1" y="1" width="18" height="10" rx="5" className={s.swNominal} /></svg>Nominal</span>
        <span className={s.lg}><svg viewBox="0 0 20 12" aria-hidden><rect x="1" y="1" width="18" height="10" rx="5" className={s.swWatch} /></svg><StatusIcon status="watch" size={14} />Watch</span>
        <span className={s.lg}><svg viewBox="0 0 20 12" aria-hidden><rect x="1" y="1" width="18" height="10" rx="5" className={s.swAct} /></svg><StatusIcon status="act" size={14} />Act (engine coupled risk only)</span>
        <span className={s.lg}><svg viewBox="0 0 20 12" aria-hidden><rect x="1" y="1" width="18" height="10" rx="5" className={s.swUnknown} /></svg>No direct reading</span>
        <span className={s.lg}><StatusIcon status="stale" size={14} />Stale: last reading over {STALE_AFTER_DAYS} days old (demo)</span>
        <span className={s.lgNote}>Bands are your own in-flight baseline. Thresholds are demo parameters.</span>
      </footer>

      {/* Portalled to <body>: <main> is its own stacking context and would put the sheet under the sidebar */}
      {sheet && selected && createPortal(
        <div className={`${s.page} ${s.scrim}`} onClick={closeSheet}>
          <div
            className={s.sheet}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            ref={sheetRef}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={s.grip} aria-hidden />
            {panel}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
