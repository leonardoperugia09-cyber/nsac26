import { useEffect, useRef, useState } from "react";
import { api, rememberCheckin, type Selection } from "../shared/api.ts";
import { readingOn } from "../data/crew.ts";
import s from "../shared/Workbench.module.css";
export function MeasurementTools({
  crewId,
  day,
  profile = "mars_transit",
}: Selection) {
  const r = readingOn(crewId, day);
  const [fluid, setFluid] = useState(r?.fluid_intake_ml ?? 0);
  const [urine, setUrine] = useState(r?.urine_color_1to8 ?? 2);
  const [mood, setMood] = useState(r?.mood_1to5 ?? 3);
  const [stress, setStress] = useState(r?.stress_1to5 ?? 2);
  const [sleep, setSleep] = useState(r?.sleep_hours ?? 7);
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [msg, setMsg] = useState("");
  const [extras, setExtras] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      [
        "heart_rate",
        "bp_sys",
        "bp_dia",
        "temp_c",
        "spo2",
        "glucose_mg_dl",
        "sodium_mg",
        "exercise_min",
        "resistance_load_kg",
        "body_mass_kg",
        "kcal_eaten",
        "vitamin_d_ng_ml",
      ].map((k) => [k, (r as any)?.[k] ?? 0]),
    ),
  );
  const [phase, setPhase] = useState<"idle" | "wait" | "ready">("idle");
  const [samples, setSamples] = useState<number[]>([]);
  const [sequence, setSequence] = useState("");
  const [visible, setVisible] = useState(false);
  const [entry, setEntry] = useState("");
  const [vision, setVision] = useState(3);
  const stamp = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(timer.current), []);
  async function save() {
    const log = {
      crewId,
      day,
      measurements: {
        ...extras,
        fluid_intake_ml: fluid,
        urine_color_1to8: urine,
        mood_1to5: mood,
        stress_1to5: stress,
        sleep_hours: sleep,
      },
      symptoms,
    };
    try {
      await api("/checkins", log);
      rememberCheckin({ ...log, pending: false });
      setMsg("Saved locally and in the demo backend.");
    } catch {
      rememberCheckin({ ...log, pending: true });
      setMsg("Saved on device; pending backend synchronization.");
    }
  }
  async function saveTest(type: string, values: number[]) {
    localStorage.setItem(
      `halo-test-${crewId}-${day}-${type}`,
      JSON.stringify(values),
    );
    window.dispatchEvent(new Event("halo-data-change"));
    try {
      await api("/tests", {
        crewId,
        day,
        type,
        values,
        protocolVersion: "halo-demo-1",
      });
      setMsg("Demo test saved. Not a clinical assessment.");
    } catch {
      localStorage.setItem(
        `halo-test-${crewId}-${day}-${type}`,
        JSON.stringify(values),
      );
      setMsg("Demo test saved on device.");
    }
  }
  function reaction() {
    if (phase === "idle") {
      setPhase("wait");
      timer.current = setTimeout(
        () => {
          stamp.current = performance.now();
          setPhase("ready");
        },
        800 + Math.random() * 1200,
      );
    } else if (phase === "ready") {
      const next = [...samples, Math.round(performance.now() - stamp.current)];
      setSamples(next);
      setPhase("idle");
      if (next.length === 5) saveTest("reaction", next);
    } else {
      clearTimeout(timer.current);
      setPhase("idle");
      setMsg("Early response; trial not counted.");
    }
  }
  function memory() {
    const a = Array.from(crypto.getRandomValues(new Uint8Array(4)), (x) =>
      String(x % 10),
    ).join("");
    setSequence(a);
    setVisible(true);
    setEntry("");
    timer.current = setTimeout(() => setVisible(false), 3000);
  }
  return (
    <>
      <h1 className={s.title}>Daily Log · Day {day}</h1>
      <p className={s.intro}>
        All inputs modify the fictional demonstration. New symptoms require
        human review independently of calculated patterns.
      </p>
      <div className={s.grid}>
        <section className={s.panel}>
          <h2>Check-in</h2>
          {[
            ["Fluid (mL)", fluid, setFluid, 0, 20000],
            ["Urine colour (1–8)", urine, setUrine, 1, 8],
            ["Mood (1–5)", mood, setMood, 1, 5],
            ["Stress (1–5)", stress, setStress, 1, 5],
            ["Sleep (hours)", sleep, setSleep, 0, 24],
          ].map(([label, value, set, min, max]) => (
            <label key={String(label)} className={s.field}>
              {String(label)}
              <input
                type="number"
                min={Number(min)}
                max={Number(max)}
                step={String(label).includes("Sleep") ? 0.1 : 1}
                value={Number(value)}
                onChange={(e) => (set as any)(Number(e.target.value))}
              />
            </label>
          ))}
          <details>
            <summary>Additional demo measurements and logs</summary>
            {Object.entries(extras).map(([key, value]) => (
              <label className={s.field} key={key}>
                {key}
                <input
                  type="number"
                  step="any"
                  value={value}
                  onChange={(e) =>
                    setExtras((x) => ({ ...x, [key]: Number(e.target.value) }))
                  }
                />
              </label>
            ))}
          </details>
          <fieldset>
            <legend>Symptoms checked today</legend>
            {[
              "chest_pain",
              "breathing_difficulty",
              "headache",
              "blurred_vision",
              "puffy_face",
              "cold_sore",
              "skin_symptoms",
            ].map((x) => (
              <label className={s.row} key={x}>
                <input
                  type="checkbox"
                  checked={symptoms.includes(x)}
                  onChange={(e) =>
                    setSymptoms((a) =>
                      e.target.checked ? [...a, x] : a.filter((v) => v !== x),
                    )
                  }
                />
                {x.replaceAll("_", " ")}
              </label>
            ))}
          </fieldset>
          {symptoms.some((x) =>
            ["chest_pain", "breathing_difficulty"].includes(x),
          ) && (
            <p role="alert">
              Seek immediate crew medical review. Do not wait to save this form.
            </p>
          )}
          <button className={s.button} onClick={save}>
            Save check-in
          </button>
          <p role="status">{msg}</p>
        </section>
        <section className={s.panel}>
          <h2>Educational tests</h2>
          <p>
            These short tasks are not validated neurocognitive or ophthalmic
            examinations.
          </p>
          <h3>Reaction task · 5 trials</h3>
          <button
            className={s.secondary}
            onClick={reaction}
            disabled={samples.length >= 5}
          >
            {phase === "ready"
              ? "NOW — click"
              : phase === "wait"
                ? "Wait for NOW"
                : "Start trial"}
          </button>
          <p aria-live="polite">
            {samples.join(", ")} {samples.length > 0 ? "ms" : ""}
          </p>
          <button className={s.secondary} onClick={() => setSamples([])}>
            Reset trials
          </button>
          <h3>Memory task</h3>
          <button className={s.secondary} onClick={memory}>
            Show four digits
          </button>
          <p>{visible ? sequence : "Digits hidden"}</p>
          <label className={s.field}>
            Enter digits
            <input
              value={entry}
              maxLength={4}
              onChange={(e) => setEntry(e.target.value)}
            />
          </label>
          <button
            className={s.secondary}
            disabled={!sequence || visible || entry.length !== 4}
            onClick={() =>
              saveTest("memory", [
                Array.from(sequence).filter((c, i) => entry[i] === c).length *
                  25,
              ])
            }
          >
            Record score
          </button>
          <h3>Vision self-report</h3>
          <label className={s.field}>
            Self-reported clarity (1 low–5 high)
            <input
              type="number"
              min="1"
              max="5"
              value={vision}
              onChange={(e) => setVision(Number(e.target.value))}
            />
          </label>
          <button
            className={s.secondary}
            onClick={() => saveTest("vision", [vision])}
          >
            Record self-report
          </button>
          <p className={s.notice}>
            This cannot detect or exclude SANS. Report new vision changes to the
            medical officer.
          </p>
        </section>
      </div>
    </>
  );
}
