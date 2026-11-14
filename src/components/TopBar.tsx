import type { CSSProperties } from "react";
import { FirstAid } from "@phosphor-icons/react";
import type { CrewMember, MissionProfile } from "../engine/types.ts";
import { LiquidNavbar } from "./ui/liquid-glass-navbar";
import s from "./TopBar.module.css";

const MISSION: Record<MissionProfile, { name: string; delay: string | null }> = {
  mars_transit: { name: "Mars transit", delay: "18 min" }, // DEMO: one-way light time varies, up to ~20 min
  moon: { name: "Moon surface", delay: "1 s" },
  iss: { name: "ISS", delay: null },
};

const words = (name: string) => name.split(" ");
const firstName = (name: string) => words(name).slice(-2)[0];
const initials = (name: string) => words(name).slice(-2).map((w) => w[0]).join("");

/** Initials avatar as SVG so it takes the pill's text colour and the tap "pop" */
const Avatar = ({ name }: { name: string }) => (
  <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
    <circle cx="12" cy="12" r="12" fill="currentColor" />
    <text x="12" y="15.6" textAnchor="middle" fontSize="9.5" fontWeight="600" fill="var(--card)" fontFamily="var(--sans)">{initials(name)}</text>
  </svg>
);

// Match the water pill to HALO's type and ink colours
const pillStyle = { fontFamily: "var(--sans)", "--n-fg": "var(--ink)", "--n-fg-soft": "var(--ink-2)" } as CSSProperties;

type Props = {
  profile: MissionProfile;
  day: number;
  crew: CrewMember[];
  selected: CrewMember;
  onSelect: (id: string) => void;
  onUrgentHelp: () => void;
};

export function TopBar({ profile, day, crew, selected, onSelect, onUrgentHelp }: Props) {
  const m = MISSION[profile];

  return (
    <header className={s.top}>
      <div className={s.info}>
        <span><span className={`mono ${s.day}`}>Day {day}</span>&nbsp;&nbsp;<span className={s.dim}>{m.name}</span></span>
        <span className={`${s.dim} ${s.push}`}>Synced 3 min ago</span>
        <span className={s.dim}>
          {m.delay ? <>Houston hears you in <span className="mono">{m.delay}</span></> : "Live link to Houston"}
        </span>
      </div>
      <LiquidNavbar
        ariaLabel="Astronaut"
        ambient="interaction"
        tone="light"
        style={pillStyle}
        active={Math.max(0, crew.findIndex((c) => c.id === selected.id))}
        onChange={(i) => onSelect(crew[i].id)}
        items={crew.map((c) => ({ label: firstName(c.name), icon: <Avatar name={c.name} />, fx: "pop" as const }))}
      />
      {/* Solid on purpose: the one control that must be found instantly */}
      <button className={s.help} onClick={onUrgentHelp}><FirstAid size={20} />Urgent help</button>
    </header>
  );
}
