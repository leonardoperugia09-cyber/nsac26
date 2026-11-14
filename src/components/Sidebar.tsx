import { Books, ChatCircleText, GearSix, Heartbeat, NotePencil, Pill, Planet, SquaresFour, type Icon } from "@phosphor-icons/react";
import { HaloMark } from "./HaloMark";
import s from "./Sidebar.module.css";

export type Page = "overview" | "health" | "log" | "assistant" | "mission" | "medicines" | "evidence" | "settings";

// Main sections first; Evidence and Settings sit at the bottom (rarely used, so demoted)
const ITEMS: { id: Page; label: string; icon: Icon }[] = [
  { id: "overview", label: "Overview", icon: SquaresFour },
  { id: "health", label: "Health", icon: Heartbeat },
  { id: "log", label: "Daily Log", icon: NotePencil },
  { id: "assistant", label: "Assistant", icon: ChatCircleText },
  { id: "mission", label: "Mission", icon: Planet },
  { id: "medicines", label: "Medicines", icon: Pill },
  { id: "evidence", label: "Evidence", icon: Books },
  { id: "settings", label: "Settings", icon: GearSix },
];

/** A flat panel, like a cabin wall: ink on light, the current section in a quiet grey pill. */
export function Sidebar({ page, onNavigate }: { page: Page; onNavigate: (p: Page) => void }) {
  return (
    <aside className={s.side}>
      <div className={s.brand}>
        <HaloMark />
        <span>HALO</span>
      </div>
      <nav className={s.nav} aria-label="Main">
        {ITEMS.map(({ id, label, icon: I }) => {
          const current = id === page;
          return (
            <button key={id} type="button" className={s.item} aria-current={current ? "page" : undefined} onClick={() => onNavigate(id)} title={label}>
              <I size={20} weight={current ? "fill" : "regular"} aria-hidden="true" />
              <span className={s.label}>{label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
