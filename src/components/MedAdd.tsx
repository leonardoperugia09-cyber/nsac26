import { useState } from "react";
import { More } from "./More";
import s from "./MedAdd.module.css";

export type NewMed = { name: string; scheduleReference: string; scheduledTime: string; expiry: string };

/** Records a schedule reference a human already approved. It never creates a dose. */
export function MedAdd({ onAdd }: { onAdd: (m: NewMed) => void }) {
  const [name, setName] = useState("");
  const [reference, setReference] = useState("");
  const [time, setTime] = useState("08:00");
  const [expiry, setExpiry] = useState("");
  const ready = name.trim() && reference.trim() && expiry;

  return (
    <More label="Add a medicine">
      <form
        className={s.form}
        onSubmit={(e) => {
          e.preventDefault();
          if (!ready) return;
          onAdd({ name: name.trim(), scheduleReference: reference.trim(), scheduledTime: time, expiry });
          setName(""); setReference(""); setExpiry("");
        }}
      >
        <p className={s.note}>Write down a schedule your flight surgeon already approved. HALO does not choose or change doses.</p>
        <label className={s.field}>Medicine name
          <input value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className={s.field}>Approved schedule reference
          <input value={reference} maxLength={160} onChange={(e) => setReference(e.target.value)} />
        </label>
        <div className={s.pair}>
          <label className={s.field}>Time
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </label>
          <label className={s.field}>Expiry on the label
            <input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
          </label>
        </div>
        <button type="submit" className={s.save} disabled={!ready}>Save reference</button>
      </form>
    </More>
  );
}
