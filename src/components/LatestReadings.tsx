import type { ReadingSummary } from "../ui/viewTypes.ts";
import { connectStrap, hasBluetooth, stopLive, useLive } from "../instruments/live.ts";
import card from "./Card.module.css";
import s from "./LatestReadings.module.css";

/** Keep ranges like "106-122 / 63-78" on one line: a break after the hyphen reads as a different number */
const keepRanges = (text: string) => text.split(/(\d[\d.]*-\d[\d.]*(?: \/ \d[\d.]*-\d[\d.]*)?)/).map((part, i) => (i % 2 ? <span key={i} className={s.nb}>{part}</span> : part));

export function LatestReadings({ readings, onAll }: { readings: ReadingSummary[]; onAll: () => void }) {
  const live = useLive();
  // A connected strap makes heart rate live; otherwise the label shows the source or how old the value is
  const isLive = (r: ReadingSummary) => r.signal === "heart_rate" && live.name !== null && live.bpm !== null;
  const side = (r: ReadingSummary) =>
    isLive(r) ? <><span className={s.liveDot} aria-hidden="true" />Live · {live.name}</>
    : r.stale ? `Old data, ${r.age.toLowerCase()}`
    : r.source ? `${r.source}, ${r.age.toLowerCase()}`
    : r.age;
  return (
    <section className={`${card.card} ${s.wide}`} aria-labelledby="read-title">
      <div className={card.head}>
        <h2 id="read-title">Latest readings</h2>
        {/* Without Bluetooth (Safari, Firefox, phones) the strap button opens Settings, which explains why and offers the simulated strap */}
        <span className={s.links}>
          {live.name ? <button onClick={stopLive}>Disconnect strap</button>
            : <button onClick={() => hasBluetooth() ? connectStrap() : window.dispatchEvent(new CustomEvent("halo-navigate", { detail: "settings" }))}>Connect strap</button>}
          <button onClick={onAll}>All readings</button>
        </span>
      </div>
      <div className={s.grid}>
        {readings.map((r) => (
          <div key={r.label}>
            <div className={s.k}>{r.label}<span className={`${s.age} ${r.stale ? s.stale : ""}`}>{side(r)}</span></div>
            <div className={`${s.v} ${r.out ? s.out : ""}`}>{isLive(r) ? live.bpm : r.value}{r.unit && <small>{r.unit}</small>}</div>
            <div className={`${s.n} ${r.out ? s.out : ""}`}>{keepRanges(r.out ? `Outside your normal. ${r.note}` : r.note)}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
