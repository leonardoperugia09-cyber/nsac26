import type { CSSProperties } from "react";
import { FirstAid } from "@phosphor-icons/react";
import type { CrewMember, MissionProfile } from "../engine/types.ts";
import { LiquidNavbar } from "./ui/liquid-glass-navbar";
import { ago, useSyncStatus } from "../shared/useSyncStatus.ts";
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
  const sync = useSyncStatus();
  const waiting = sync.pending ? ` · ${sync.pending} waiting to send` : "";
  const online = !!(sync.ok && sync.at);
  const linkText = sync.ok === null ? "Checking" : online ? `Synced ${ago(sync.at!, sync.now)}${waiting}` : `Offline${waiting}`;

  return (
    <header className={s.top}>
      {/* An instrument readout: a small label above each value, like the fields on a cabin display */}
      <div className={s.info}>
        <div className={s.field}><span className={s.label}>Mission day</span><span className={s.value}>{day} · {m.name}</span></div>
        <div className={s.field}>
          <span className={s.label}>{m.delay ? "Houston hears you in" : "Houston"}</span>
          <span className={s.value}>{m.delay ?? "Live link"}</span>
        </div>
        <div className={`${s.field} ${s.link}`} title={online ? "Connected to the HALO server" : "The HALO server is not reachable. Check-ins are kept on this device and sent when the link is back."}>
          <span className={s.label}>Link</span>
          <span className={s.value} role="status"><span className={`${s.dot} ${online ? s.on : ""}`} aria-hidden="true" />{linkText}</span>
        </div>
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
