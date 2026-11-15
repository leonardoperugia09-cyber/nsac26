import { ArrowRight, ChatCircleText, Heartbeat, NotePencil, Pill, Planet, type Icon } from "@phosphor-icons/react";
import s from "./QuickLinks.module.css";

export type QuickLink = {
  id: string;
  label: string;
  /** One short live line: what is waiting there right now */
  status: string;
  tone?: "watch" | "act" | "done";
  onOpen: () => void;
};

const ICONS: Record<string, Icon> = { log: NotePencil, health: Heartbeat, medicines: Pill, assistant: ChatCircleText, mission: Planet };

/** One-tap jumps from the homepage to the places people use most, each with what's waiting there. */
export function QuickLinks({ links }: { links: QuickLink[] }) {
  return (
    <nav className={s.row} aria-label="Jump to">
      {links.map((l) => {
        const I = ICONS[l.id] ?? ArrowRight;
        return (
          <button key={l.id} type="button" className={`${s.tile} ${l.tone ? s[l.tone] : ""}`} onClick={l.onOpen}>
            <span className={s.icon} aria-hidden="true"><I size={20} weight={l.tone === "watch" || l.tone === "act" ? "bold" : "regular"} /></span>
            <span className={s.text}>
              <b>{l.label}</b>
              <span>{l.status}</span>
            </span>
            <ArrowRight size={16} className={s.arrow} aria-hidden="true" />
          </button>
        );
      })}
    </nav>
  );
}
