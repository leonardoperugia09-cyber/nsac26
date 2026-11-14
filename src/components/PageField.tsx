import { useLayoutEffect, type RefObject } from "react";
import { createPortal } from "react-dom";
import s from "./PageField.module.css";

/** Page position of an element's bottom edge, ignoring transforms (so an entrance animation doesn't skew it). */
const bottomOf = (el: HTMLElement) => {
  let y = el.offsetHeight;
  for (let n: HTMLElement | null = el; n; n = n.offsetParent as HTMLElement | null) y += n.offsetTop;
  return y;
};

/** The warning lamp behind the Overview hero, lit only at Watch or Act.
 *  It always ends 28 px below `edge`, so nothing ever sits on its border. */
export function PageField({ state, edge }: { state: "watch" | "act"; edge: RefObject<HTMLElement | null> }) {
  useLayoutEffect(() => {
    const el = edge.current;
    if (!el) return;
    const fit = () => document.documentElement.style.setProperty("--field-bottom", `${bottomOf(el) + 28}px`);
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => { ro.disconnect(); document.documentElement.style.removeProperty("--field-bottom"); };
  }, [edge]);
  return createPortal(<div key={state} className={s.field} data-state={state} aria-hidden="true" />, document.body);
}
