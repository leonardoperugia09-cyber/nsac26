import { useEffect, useMemo, useRef, useState } from "react";
import { contextOf, readingOn } from "../data/crew.ts";
import { driftOn } from "../ui/systems.ts";
import { fmtNum, fmtRange } from "../ui/healthData.ts";
import { URINE_COLOURS, VISION_OVERDUE } from "../ui/logData.ts";
import { api, rememberCheckin } from "../shared/api.ts";
import { triage } from "../shared/triage.ts";
import card from "../components/Card.module.css";
import { More } from "../components/More";
import { PageHero } from "../components/PageHero";
import s from "./DailyLog.module.css";

type Props = { crewId: string; day: number; quickMood?: number | null; onSaved?: () => void };
type TestType = "reaction" | "memory" | "vision";
type SaveTest = (type: TestType, values: number[]) => Promise<boolean>;
type Status = "saving" | "sent" | "device" | null;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(v)));
const FIVE = [1, 2, 3, 4, 5];

// Symptom ids the backend accepts (backend/node/contracts.ts). triage.ts marks the first two as urgent.
const SYMPTOMS: [string, string][] = [
  ["chest_pain", "Chest pain"], ["breathing_difficulty", "Trouble breathing"], ["headache", "Headache"],
  ["blurred_vision", "Blurred vision"], ["puffy_face", "Puffy face"], ["cold_sore", "Cold sore"], ["skin_symptoms", "Skin problem"],
];

const EXTRAS: [string, [string, string][]][] = [
  ["Vitals", [["heart_rate", "Heart rate, bpm"], ["bp_sys", "Upper blood pressure, mmHg"], ["bp_dia", "Lower blood pressure, mmHg"],
    ["temp_c", "Temperature, °C"], ["spo2", "Oxygen, %"], ["glucose_mg_dl", "Glucose, mg/dL"]]],
  ["Exercise", [["exercise_min", "Exercise, min"], ["resistance_load_kg", "Resistance load, kg"], ["body_mass_kg", "Body mass, kg"]]],
  ["Food", [["kcal_eaten", "Food eaten, kcal"], ["sodium_mg", "Sodium, mg"], ["vitamin_d_ng_ml", "Vitamin D, ng/mL"]]],
];
// The backend rejects values outside these.
const LIMITS: Record<string, [number, number]> = { sleep_hours: [0, 24], spo2: [0, 100] };

function Scale({ name, legend, value, onChange, ends = ["Low", "High"] }: { name: string; legend: string; value: number; onChange: (n: number) => void; ends?: [string, string] }) {
  return (
    <fieldset className={s.field}>
      <legend>{legend}</legend>
      <div className={s.scale} role="radiogroup" aria-label={legend}>
        {FIVE.map((n) => (
          <label key={n} className={s.sq}>
            <input type="radio" name={name} checked={value === n} onChange={() => onChange(n)} />
            <span>{n}</span>
          </label>
        ))}
      </div>
      <div className={s.ends}><span>{ends[0]}</span><span>{ends[1]}</span></div>
    </fieldset>
  );
}

function useSave(save: SaveTest, type: TestType) {
  const [status, setStatus] = useState<Status>(null);
  const run = async (values: number[]) => { setStatus("saving"); setStatus((await save(type, values)) ? "sent" : "device"); };
  return [status, run, () => setStatus(null)] as const;
}

function TestStatus({ status }: { status: Status }) {
  if (!status) return null;
  return <p className={s.saved} role="status">{status === "saving" ? "Saving" : status === "sent" ? "Saved" : "Saved on this device"}</p>;
}

function ReactionTask({ save }: { save: SaveTest }) {
  const [phase, setPhase] = useState<"idle" | "wait" | "ready">("idle");
  const [samples, setSamples] = useState<number[]>([]);
  const [early, setEarly] = useState(false);
  const [status, run, reset] = useSave(save, "reaction");
  const stamp = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const done = samples.length >= 5;

  function tap() {
    if (phase === "idle") {
      setEarly(false);
      setPhase("wait");
      timer.current = setTimeout(() => { stamp.current = performance.now(); setPhase("ready"); }, 800 + Math.random() * 1200);
    } else if (phase === "ready") {
      const next = [...samples, Math.round(performance.now() - stamp.current)];
      setSamples(next);
      setPhase("idle");
      if (next.length === 5) run(next);
    } else {
      clearTimeout(timer.current);
      setPhase("idle");
      setEarly(true);
    }
  }
  function restart() { clearTimeout(timer.current); setPhase("idle"); setSamples([]); setEarly(false); reset(); }

  return (
    <div className={s.task}>
      <p className={s.taskText}>Tap the box as soon as it turns orange. 5 tries.</p>
      <button type="button" className={`${s.pad} ${phase === "ready" ? s.ready : ""}`} disabled={done} onClick={tap}>
        {done ? "All 5 tries done" : phase === "ready" ? "Tap now" : phase === "wait" ? "Wait for orange" : `Tap to start try ${samples.length + 1} of 5`}
      </button>
      {early && <p className={s.note} role="status">Too early. That try did not count.</p>}
      {samples.length > 0 && <p className={s.result}><span className="mono">{samples.join(", ")} ms</span></p>}
      {done && <p className={s.result}>Average <span className="mono">{Math.round(samples.reduce((a, b) => a + b, 0) / samples.length)} ms</span></p>}
      <TestStatus status={status} />
      {samples.length > 0 && <button type="button" className={s.text} onClick={restart}>Start over</button>}
    </div>
  );
}

function MemoryTask({ save }: { save: SaveTest }) {
  const [digits, setDigits] = useState("");
  const [visible, setVisible] = useState(false);
  const [entry, setEntry] = useState("");
  const [score, setScore] = useState<number | null>(null);
  const [status, run, reset] = useSave(save, "memory");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  function show() {
    clearTimeout(timer.current);
    setDigits(Array.from(crypto.getRandomValues(new Uint8Array(4)), (x) => String(x % 10)).join(""));
    setVisible(true);
    setEntry("");
    setScore(null);
    reset();
    timer.current = setTimeout(() => setVisible(false), 3000);
  }
  function record() {
    const n = Array.from(digits).filter((c, i) => entry[i] === c).length * 25;
    setScore(n);
    run([n]);
  }

  return (
    <div className={s.task}>
      <p className={s.taskText}>Remember 4 digits. They hide after 3 seconds.</p>
      {visible && <div className={`mono ${s.big} ${s.digits}`}>{digits}</div>}
      {!visible && digits && score === null && (
        <div className={s.field}>
          <label htmlFor="memory-entry" className={s.legend}>Type the digits</label>
          <div className={s.row}>
            <input id="memory-entry" className={`mono ${s.num}`} inputMode="numeric" autoComplete="off" maxLength={4} autoFocus
              value={entry} onChange={(e) => setEntry(e.target.value.replace(/\D/g, ""))} />
            <button type="button" className={s.outline} disabled={entry.length !== 4} onClick={record}>Record score</button>
          </div>
        </div>
      )}
      {score !== null && <p className={s.result}><span className="mono">{score} of 100</span></p>}
      <TestStatus status={status} />
      {!visible && <button type="button" className={s.outline} onClick={show}>{digits ? "Try again" : "Show digits"}</button>}
    </div>
  );
}

function VisionTask({ save, initial }: { save: SaveTest; initial: number }) {
  const [clarity, setClarity] = useState(initial);
  const [status, run, reset] = useSave(save, "vision");
  return (
    <div className={s.task}>
      <Scale name="vision" legend="How clear is your vision today?" ends={["Blurry", "Clear"]} value={clarity} onChange={(n) => { setClarity(n); reset(); }} />
      <button type="button" className={s.outline} onClick={() => run([clarity])}>Record answer</button>
      <TestStatus status={status} />
      <p className={s.note}>This is your own report. It cannot find or rule out eye changes. Tell your medical officer about any new change in your vision.</p>
    </div>
  );
}

export function DailyLog({ crewId, day, quickMood, onSaved }: Props) {
  // Saved check-ins and tests change what readingOn returns, so re-read when they do.
  const [rev, setRev] = useState(0);
  useEffect(() => {
    const bump = () => setRev((x) => x + 1);
    window.addEventListener("halo-data-change", bump);
    return () => window.removeEventListener("halo-data-change", bump);
  }, []);
  const today = readingOn(crewId, day);
  const vision = contextOf(crewId, day).vision_score as number | undefined;
  const drift = useMemo(() => driftOn(crewId, day), [crewId, day, rev]);

  const [fluid, setFluid] = useState<number[]>(() => [today?.fluid_intake_ml ?? 0]);
  const [urine, setUrine] = useState(() => clamp(today?.urine_color_1to8 ?? 3, 1, 8));
  const [mood, setMood] = useState(() => quickMood ?? clamp(today?.mood_1to5 ?? 3, 1, 5)); // Leo: the homepage check-in fills in mood
  const [stress, setStress] = useState(() => clamp(today?.stress_1to5 ?? 3, 1, 5));
  const [sleep, setSleep] = useState(() => (today?.sleep_hours ?? 7).toFixed(2).replace(/0$/, ""));
  const [extras, setExtras] = useState<Record<string, string>>(() => Object.fromEntries(EXTRAS.flatMap(([, fields]) => fields).map(([k]) => {
    const v = (today as Record<string, unknown> | undefined)?.[k];
    return [k, typeof v === "number" ? String(Math.round(v * 10) / 10) : ""];
  })));
  const [symptoms, setSymptoms] = useState<string[]>(() => contextOf(crewId, day).symptoms ?? []);
  const [saved, setSaved] = useState<Status>(null);
  const [open, setOpen] = useState<TestType | null>(null);

  const total = fluid.reduce((a, b) => a + b, 0);
  const fd = drift.fluid_intake_ml;
  const short = fd ? Math.max(0, fd.bandLo - total) : 0;
  const rd = drift.reaction_time_ms;
  const urgent = triage("", symptoms).urgent;
  const toggle = (id: string) => setSymptoms((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  const toggleTest = (id: TestType) => setOpen((cur) => (cur === id ? null : id));
  const dirty = () => setSaved(null);

  async function save() {
    const measurements: Record<string, number> = { fluid_intake_ml: total, urine_color_1to8: urine, mood_1to5: mood, stress_1to5: stress };
    for (const [k, v] of Object.entries({ ...extras, sleep_hours: sleep })) {
      const n = Number(v);
      if (v.trim() === "" || !Number.isFinite(n)) continue;
      const [lo, hi] = LIMITS[k] ?? [-Infinity, Infinity];
      measurements[k] = Math.min(hi, Math.max(lo, n));
    }
    const log = { crewId, day, measurements, symptoms };
    setSaved("saving");
    try {
      await api("/checkins", log);
      rememberCheckin({ ...log, pending: false });
      setSaved("sent");
    } catch {
      rememberCheckin({ ...log, pending: true });
      setSaved("device");
    }
    onSaved?.();
  }

  const saveTest: SaveTest = async (type, values) => {
    localStorage.setItem(`halo-test-${crewId}-${day}-${type}`, JSON.stringify(values));
    window.dispatchEvent(new Event("halo-data-change"));
    try {
      await api("/tests", { crewId, day, type, values, protocolVersion: "halo-demo-1" });
      return true;
    } catch {
      return false;
    }
  };

  return (
    <>
      <PageHero page="Daily Log" state={short > 0 ? "watch" : "normal"}
        title={short > 0 ? `Drink ${(short / 1000).toFixed(1)} L more today` : "Your fluid is inside your normal today"}
        line={`Day ${day} check-in. Takes about 2 minutes.`} />
      <div className={s.grid}>
        <section className={`${card.card} ${s.checkin}`} aria-label="Check-in">
          <fieldset className={s.field}>
            <legend>Fluid today</legend>
            <div className={`mono ${s.big}`}>{(total / 1000).toFixed(2)} L</div>
            <div className={s.row}>
              <button type="button" className={s.outline} onClick={() => { setFluid([...fluid, 250]); dirty(); }}>+250 ml</button>
              <button type="button" className={s.outline} onClick={() => { setFluid([...fluid, 500]); dirty(); }}>+500 ml</button>
              <button type="button" className={s.text} disabled={fluid.length <= 1} onClick={() => { setFluid(fluid.slice(0, -1)); dirty(); }}>Undo</button>
            </div>
            {fd && <p className={s.hint}>Your normal {fmtRange("fluid_intake_ml", fd.bandLo, fd.bandHi)}</p>}
          </fieldset>

          <fieldset className={s.field}>
            <legend>Urine colour</legend>
            <div className={s.swatches} role="radiogroup" aria-label="Urine colour">
              {URINE_COLOURS.map((c, i) => (
                <label key={c} className={s.swatch}>
                  <input type="radio" name="urine" aria-label={`Urine colour ${i + 1} of 8`} checked={urine === i + 1} onChange={() => { setUrine(i + 1); dirty(); }} />
                  <span style={{ background: c }} />
                </label>
              ))}
            </div>
            <div className={`${s.ends} ${s.swatchEnds}`}><span>Pale</span><span>Dark</span></div>
            {urine >= 5 && <p className={s.amber}>Darker than your normal. Drink more and check again tonight.</p>}
          </fieldset>

          <Scale name="mood" legend="Mood" value={mood} onChange={(n) => { setMood(n); dirty(); }} />
          <Scale name="stress" legend="Stress" value={stress} onChange={(n) => { setStress(n); dirty(); }} />

          <div className={s.field}>
            <label htmlFor="sleep" className={s.legend}>Sleep last night, hours</label>
            <input id="sleep" type="number" inputMode="decimal" className={`mono ${s.num}`} step={0.25} min={0} max={14} value={sleep}
              onChange={(e) => { setSleep(e.target.value); dirty(); }} />
          </div>

          <fieldset className={s.field}>
            <legend>Symptoms</legend>
            <div className={s.row}>
              {SYMPTOMS.map(([id, label]) => (
                <label key={id} className={s.chip}>
                  <input type="checkbox" checked={symptoms.includes(id)} onChange={() => { toggle(id); dirty(); }} />
                  <span>{label}</span>
                </label>
              ))}
            </div>
            {urgent && (
              <div className={s.urgent} role="alert">
                <p>Press Urgent help now. You can save this later.</p>
                <button type="button" className={s.actBtn}
                  onClick={() => window.dispatchEvent(new Event("halo-urgent"))}>Open Urgent help</button>
              </div>
            )}
            {symptoms.includes("blurred_vision") && <p className={s.amber}>Tell your crew medical officer today and do the vision self-test.</p>}
          </fieldset>

          <More label="Add vitals, exercise and food">
            <div className={s.extras}>
              {EXTRAS.map(([group, fields]) => (
                <fieldset key={group} className={s.field}>
                  <legend>{group}</legend>
                  <div className={s.extraGrid}>
                    {fields.map(([k, label]) => (
                      <label key={k}>
                        {label}
                        <input type="number" inputMode="decimal" step="any" className={`mono ${s.num}`} value={extras[k]}
                          onChange={(e) => { setExtras((x) => ({ ...x, [k]: e.target.value })); dirty(); }} />
                      </label>
                    ))}
                  </div>
                </fieldset>
              ))}
            </div>
          </More>

          <div className={s.save}>
            <button type="button" className={s.cta} onClick={save}>Save check-in</button>
            {saved && (
              <span className={s.saved} role="status">
                {saved === "saving" ? "Saving" : saved === "sent" ? `Saved for Day ${day}` : "Saved on this device. Waiting to send."}
              </span>
            )}
          </div>
        </section>

        <section className={`${card.card} ${s.tests}`} aria-labelledby="tests-title">
          <div>
            <h2 id="tests-title" className={s.testsTitle}>Tests</h2>
            <p className={s.hint}>Recorded results for your own trend. Not a medical exam.</p>
          </div>

          <div className={s.test}>
            <div className={s.testTop}>
              <div><b>Reaction test</b> <span className={s.dur}>1 min</span></div>
              <button type="button" className={s.text} aria-expanded={open === "reaction"} onClick={() => toggleTest("reaction")}>{open === "reaction" ? "Close" : "Start"}</button>
            </div>
            {today && <p className={s.result}><span className={`mono ${rd?.status !== "inside band" ? s.amberText : ""}`}>{fmtNum("reaction_time_ms", today.reaction_time_ms)} ms</span> today</p>}
            {rd && <p className={s.hint}>Your normal {fmtRange("reaction_time_ms", rd.bandLo, rd.bandHi)}</p>}
            {open === "reaction" && <ReactionTask save={saveTest} />}
          </div>

          <div className={s.test}>
            <div className={s.testTop}>
              <div><b>Memory task</b> <span className={s.dur}>1 min</span></div>
              <button type="button" className={s.text} aria-expanded={open === "memory"} onClick={() => toggleTest("memory")}>{open === "memory" ? "Close" : "Start"}</button>
            </div>
            {today && <p className={s.result}><span className="mono">{fmtNum("memory_score", today.memory_score)} of 100</span> today</p>}
            {open === "memory" && <MemoryTask save={saveTest} />}
          </div>

          <div className={s.test}>
            <div className={s.testTop}>
              <div><b>Vision self-test</b> <span className={s.dur}>Weekly</span></div>
                <button type="button" className={s.secondary} aria-expanded={open === "vision"} onClick={() => toggleTest("vision")}>{open === "vision" ? "Close" : "Start"}</button>
            </div>
            {vision
              ? <p className={s.result}><span className="mono">{vision} of 5</span> clarity today</p>
              : <p className={`${s.result} ${s.amberText}`}>{VISION_OVERDUE}</p>}
            {open === "vision" && <VisionTask save={saveTest} initial={vision ?? 3} />}
          </div>
        </section>
      </div>
    </>
  );
}
