import type { CSSProperties } from "react";
import { Books, ChatCircleText, GearSix, Heartbeat, NotePencil, Pill, Planet, SquaresFour, type Icon } from "@phosphor-icons/react";
import { LiquidGlass } from "./ui/apple-tahoe-liquid-glass-button";
import { LiquidNavbar } from "./ui/liquid-glass-navbar";
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

const waterStyle = { fontFamily: "var(--sans)", "--n-fg": "var(--ink)", "--n-fg-soft": "var(--ink-2)" } as CSSProperties;

export function Sidebar({ page, onNavigate }: { page: Page; onNavigate: (p: Page) => void }) {
  return (
    <LiquidGlass asChild material="regular" refraction={28}>
      <aside className={s.side}>
        <div className={s.brand}>
          {/* Mars inside its halo: the ring's back half sits behind the planet, the front half crosses it */}
          <HaloMark />
          <span>HALO</span>
        </div>
        {/* Water drop slides between sections; bare = no second glass inside the glass sidebar */}
        <LiquidNavbar
          className={s.water}
          ariaLabel="Main"
          orientation="vertical"
          bare
          ambient="interaction"
          tone="light"
          style={waterStyle}
          active={Math.max(0, ITEMS.findIndex((i) => i.id === page))}
          onChange={(i) => onNavigate(ITEMS[i].id)}
          items={ITEMS.map(({ label, icon: I }) => ({ label, icon: <I size={20} />, fx: "pop" as const }))}
        />
      </aside>
    </LiquidGlass>
  );
}
