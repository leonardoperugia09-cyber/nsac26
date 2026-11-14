import type { ReactNode } from "react";
import type { RiskLevel } from "../ui/viewTypes.ts";
import s from "./PageHero.module.css";

type Props = { page: string; state: RiskLevel; title: ReactNode; line?: ReactNode; aside?: ReactNode; children?: ReactNode };

/** A page's one loud thing: what matters on this page right now. No colour field here: the warning lamp is the Overview's. */
export function PageHero({ page, state, title, line, aside, children }: Props) {
  return (
    <header className={s.hero}>
      <div className={s.top}>
        <p className={s.eyebrow}>
          {page}{state !== "normal" && <>&nbsp;&nbsp;<b className={state === "act" ? s.act : s.watch}>{state === "act" ? "Act" : "Watch"}</b></>}
        </p>
        {aside}
      </div>
      <h1 className={s.title}>{title}</h1>
      {line && <p className={s.line}>{line}</p>}
      {children && <div className={s.actions}>{children}</div>}
    </header>
  );
}
