import { FirstAid } from "@phosphor-icons/react";
import type { CrewMember, MissionProfile } from "../engine/types.ts";
import s from "./TopBar.module.css";

const MISSION: Record<MissionProfile, { name: string; delay: string | null }> = {
  mars_transit: { name: "Mars transit", delay: "18 min" }, // DEMO: one-way light time varies, up to ~20 min
  moon: { name: "Moon surface", delay: "1 s" },
  iss: { name: "ISS", delay: null },
};

const words = (name: string) => name.split(" ");
const firstName = (name: string) => words(name).slice(-2)[0];
const initials = (name: string) => words(name).slice(-2).map((w) => w[0]).join("");

/** Initials avatar as SVG; it takes the button's text colour (grey, ink when selected) */
const Avatar = ({ name }: { name: string }) => (
  <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
    <circle cx="12" cy="12" r="12" fill="currentColor" />
    <text x="12" y="15.6" textAnchor="middle" fontSize="9.5" fontWeight="600" fill="var(--card)" fontFamily="var(--sans)">{initials(name)}</text>
  </svg>
);

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
      <div className={s.crew} role="group" aria-label="Astronaut">
        {crew.map((c) => (
          <button key={c.id} type="button" className={s.member} aria-pressed={c.id === selected.id} onClick={() => onSelect(c.id)}>
            <Avatar name={c.name} />{firstName(c.name)}
          </button>
        ))}
      </div>
      {/* Solid on purpose: the one control that must be found instantly */}
      <button className={s.help} onClick={onUrgentHelp}><FirstAid size={20} />Urgent help</button>
    </header>
  );
}
