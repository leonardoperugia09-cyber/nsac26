import { useEffect, useRef, useState } from "react";
import { ArrowRight, Smiley, SmileyMeh, SmileyNervous, SmileySad, X, type Icon } from "@phosphor-icons/react";
import s from "./QuickCheckin.module.css";

/** Mood 1-5, same scale as the Daily Log's mood field */
export const FEELINGS: { mood: number; label: string; icon: Icon; fill?: boolean }[] = [
  { mood: 1, label: "Rough", icon: SmileySad },
  { mood: 2, label: "Low", icon: SmileyNervous },
  { mood: 3, label: "Okay", icon: SmileyMeh },
  { mood: 4, label: "Good", icon: Smiley },
  { mood: 5, label: "Great", icon: Smiley, fill: true },
];

type Props = {
  name: string;
  day: number;
  mood: number | null;
  onMood: (mood: number) => void;
  onOpenLog: () => void;
  onTalk: () => void;
  onLater: () => void;
};

/** Pops up on the homepage until today's Daily Log is saved: one quick question, then straight to the full log. */
export function QuickCheckin({ name, day, mood, onMood, onOpenLog, onTalk, onLater }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [picked, setPicked] = useState(mood);

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) { d.showModal(); d.focus(); }
    return () => d?.close();
  }, []);

  const pick = (m: number) => { setPicked(m); onMood(m); };
  const feeling = FEELINGS.find((f) => f.mood === picked);

  return (
    <dialog ref={ref} tabIndex={-1} className={s.dialog} aria-labelledby="qc-title" onCancel={(e) => { e.preventDefault(); onLater(); }}
      onClick={(e) => { if (e.target === ref.current) onLater(); }}>
      <div className={s.box}>
        <button type="button" className={s.close} aria-label="Close, remind me later" onClick={onLater}><X size={18} weight="bold" /></button>
        <p className={s.eyebrow}><span className={s.dot} aria-hidden="true" />Daily log not done · Day <span className="mono">{day}</span></p>
        <h2 id="qc-title" className={s.title}>How are you doing, {name}?</h2>

        <div className={s.faces} role="radiogroup" aria-labelledby="qc-title">
          {FEELINGS.map(({ mood: m, label, icon: I, fill }) => (
            <button key={m} type="button" role="radio" aria-checked={picked === m} className={`${s.face} ${picked === m ? s.on : ""}`} onClick={() => pick(m)}>
              <I size={30} weight={fill ? "fill" : picked === m ? "bold" : "regular"} />
              <span>{label}</span>
            </button>
          ))}
        </div>

        {feeling && (
          <p className={s.thanks} role="status">
            {picked !== null && picked <= 2
              ? <>Thanks for telling HALO. <button type="button" className={s.inline} onClick={onTalk}>Talk it through with the assistant</button></>
              : <>Noted: {feeling.label.toLowerCase()}. It's already in today's log.</>}
          </p>
        )}

        <div className={s.actions}>
          <button type="button" className={s.cta} onClick={onOpenLog}>
            Do my daily log<span className={s.time}>2 min</span><ArrowRight size={18} weight="bold" />
          </button>
          <button type="button" className={s.later} onClick={onLater}>Later</button>
        </div>
      </div>
    </dialog>
  );
}
