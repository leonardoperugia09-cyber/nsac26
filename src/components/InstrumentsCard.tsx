import { useMemo, useRef, useState } from "react";
import { SIM, crewById } from "../data/crew.ts";
import { SIGNALS } from "../engine/signals.ts";
import { connectStrap, hasBluetooth, startSimulated, stopLive, useLive } from "../instruments/live.ts";
import { guessMapping, parseCsv, PRESETS, toMeasurements, type ColumnMapping, type CsvTable } from "../instruments/csv.ts";
import { parseAppleHealthExport } from "../instruments/appleHealth.ts";
import { INSTRUMENT_UNITS, type InstrumentSignal } from "../instruments/types.ts";
import { addMeasurements, localMeasurements, measurementsOn, type Measurement } from "../shared/measurements.ts";
import { fhirBundle } from "../shared/fhir.ts";
import { useDataRevision } from "../shared/useDataRevision.ts";
import card from "./Card.module.css";
import s from "./InstrumentsCard.module.css";

const SIGNAL_LABEL: Record<InstrumentSignal, string> = {
  heart_rate: "Heart rate",
  bp_sys: "Blood pressure, upper",
  bp_dia: "Blood pressure, lower",
  temp_c: "Temperature",
  spo2: "Blood oxygen",
  sleep_hours: "Sleep",
  body_mass_kg: "Weight",
};
const UNIT_OF = Object.fromEntries(SIGNALS.map((g) => [g.key, g.unit]));

type Pending =
  | { kind: "csv"; file: string; table: CsvTable; mapping: ColumnMapping }
  | { kind: "apple"; file: string; measurements: Measurement[]; days: [number, number] | null };

const dayRange = (d: [number, number] | null) => (!d ? "no mission days" : d[0] === d[1] ? `day ${d[0]}` : `days ${d[0]} to ${d[1]}`);

/** Settings card: live strap, file import into the selected astronaut, FHIR download, and the sources used so far. */
export function InstrumentsCard({ crewId, day }: { crewId: string; day: number }) {
  const live = useLive();
  const revision = useDataRevision();
  const name = crewById(crewId).name.split(" ").slice(-2).join(" "); // "Marco Ricci", without the role
  const fileInput = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [reading, setReading] = useState(false);

  const csvSource = pending?.kind === "csv" ? (pending.mapping.preset ? PRESETS[pending.mapping.preset].label.split(" (")[0] : pending.file.replace(/\.[^.]+$/, "")) : "";
  const preview = useMemo(
    () => (pending?.kind === "csv" ? toMeasurements(pending.table.rows, pending.mapping, { crewId, currentDay: day, sourceId: csvSource }) : null),
    [pending, crewId, day, csvSource],
  );
  const toImport = pending?.kind === "apple" ? pending.measurements : preview?.measurements ?? [];
  const importDays = pending?.kind === "apple" ? pending.days : preview?.days ?? null;

  const sources = useMemo(() => {
    const by = new Map<string, Set<number>>();
    for (const m of localMeasurements()) if (m.crewId === crewId) by.set(m.sourceId, (by.get(m.sourceId) ?? new Set()).add(m.missionDay));
    return [...by].map(([id, days]) => ({ id, days: days.size, last: Math.max(...days) }));
  }, [crewId, revision]);

  async function choose(file: File) {
    setMessage(null);
    setReading(true);
    try {
      if (/\.xml$/i.test(file.name)) {
        const r = await parseAppleHealthExport(file, { crewId, currentDay: day });
        setPending({ kind: "apple", file: file.name, measurements: r.measurements, days: r.days });
      } else {
        const table = parseCsv(await file.text());
        setPending({ kind: "csv", file: file.name, table, mapping: guessMapping(table.headers) });
      }
    } catch {
      setMessage("This file could not be read. Choose a CSV file or the export.xml from an Apple Health export.");
    } finally {
      setReading(false);
    }
  }

  function setColumn(header: string, signal: string) {
    if (pending?.kind !== "csv") return;
    const columns = { ...pending.mapping.columns };
    if (signal) columns[header] = { signal: signal as InstrumentSignal };
    else delete columns[header];
    setPending({ ...pending, mapping: { ...pending.mapping, columns, preset: undefined } });
  }

  async function runImport() {
    const n = new Set(toImport.map((m) => m.missionDay)).size;
    await addMeasurements(toImport);
    setPending(null);
    setMessage(`Imported ${n} ${n === 1 ? "day" : "days"} into ${name}.`);
  }

  function downloadFhir() {
    const row = SIM.readings.find((r) => r.crew_id === crewId && r.day === day) as unknown as Record<string, unknown> | undefined;
    const bundle = fhirBundle(name, crewId, day, [...measurementsOn(crewId, day).values()], row, UNIT_OF);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(bundle, null, 2)], { type: "application/fhir+json" }));
    a.download = `halo-${crewId}-day-${day}-fhir.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  return (
    <section className={`${card.card} ${s.card}`} aria-labelledby="inst-title">
      <div className={card.head}><h2 id="inst-title">Instruments</h2></div>

      <div className={s.block}>
        <h3>Heart-rate strap</h3>
        {live.name
          ? <p className={s.live}><span className={s.dot} aria-hidden="true" />Live · {live.name} · <b>{live.bpm ?? "…"}</b> bpm</p>
          : <p className={s.status}>No strap connected</p>}
        <div className={s.actions}>
          {live.name
            ? <button className={s.secondary} onClick={stopLive}>Disconnect</button>
            : <>
                <button className={s.secondary} onClick={connectStrap} disabled={!hasBluetooth()}>Connect strap</button>
                <button className={s.text} onClick={startSimulated}>Use simulated strap</button>
              </>}
        </div>
        {live.error && <p className={s.error} role="alert">{live.error}</p>}
        <p className={s.note}>
          {hasBluetooth() ? "Pairs with a Bluetooth heart-rate strap such as a Polar H10." : "Bluetooth needs Chrome or Edge on a computer."}{" "}
          Every minute the average is saved as today's heart rate for {name}. An Apple Watch can't stream to a browser, so import its Health export below.
        </p>
      </div>

      <div className={s.block}>
        <h3>Import a file</h3>
        <input ref={fileInput} type="file" accept=".csv,.txt,.xml,text/csv,text/xml" hidden
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void choose(f); e.target.value = ""; }} />
        {!pending && (
          <div className={s.actions}>
            <button className={s.secondary} onClick={() => fileInput.current?.click()} disabled={reading}>{reading ? "Reading file" : "Choose a file"}</button>
          </div>
        )}
        {pending?.kind === "csv" && (
          <div className={s.preview}>
            <p className={s.status}>{pending.file}{pending.mapping.preset ? ` · looks like ${PRESETS[pending.mapping.preset].label}` : ""}</p>
            <div className={s.map} role="group" aria-label="Which column is which">
              {pending.table.headers.filter((h) => h !== pending.mapping.date && h !== pending.mapping.day).map((h) => (
                <label key={h} className={s.mapRow}>
                  <span>{h}</span>
                  <select value={pending.mapping.columns[h]?.signal ?? ""} onChange={(e) => setColumn(h, e.target.value)}>
                    <option value="">Skip</option>
                    {(Object.keys(INSTRUMENT_UNITS) as InstrumentSignal[]).map((k) => <option key={k} value={k}>{SIGNAL_LABEL[k]}</option>)}
                  </select>
                </label>
              ))}
            </div>
            <p className={s.note}>
              {pending.mapping.day ? `Mission days come from the "${pending.mapping.day}" column.` : pending.mapping.date ? `Dates come from "${pending.mapping.date}"; the newest date becomes day ${day}.` : "No date or day column found, so nothing can be placed on a mission day."}
              {preview?.skipped ? ` ${preview.skipped} rows were skipped.` : ""}
            </p>
          </div>
        )}
        {pending?.kind === "apple" && (
          <div className={s.preview}>
            <p className={s.status}>{pending.file} · Apple Health</p>
            <p className={s.note}>Heart rate, blood oxygen, temperature, weight and sleep, one value per day. The newest day becomes day {day}.</p>
          </div>
        )}
        {pending && (
          <div className={s.actions}>
            <button className={s.cta} onClick={runImport} disabled={!toImport.length}>
              {toImport.length ? `Import ${dayRange(importDays)} into ${name}` : "Nothing to import"}
            </button>
            <button className={s.text} onClick={() => setPending(null)}>Cancel</button>
          </div>
        )}
        {message && <p className={s.note} role="status">{message}</p>}
        {!pending && !message && (
          <p className={s.note}>A CSV from an Actiwatch, a Hexoskin or a spreadsheet, or export.xml from an Apple Health export (unzip it first). You check which column is which before anything is saved.</p>
        )}
      </div>

      <div className={s.block}>
        <h3>Export</h3>
        <div className={s.actions}><button className={s.secondary} onClick={downloadFhir}>Download FHIR file</button></div>
        <p className={s.note}>Day {day} readings for {name} in FHIR, the format hospital record systems read.</p>
      </div>

      {sources.length > 0 && (
        <div className={s.block}>
          <h3>Sources for {name}</h3>
          <ul className={s.sources}>
            {sources.map((x) => <li key={x.id}><span>{x.id}</span><span>{x.days} {x.days === 1 ? "day" : "days"}, latest day {x.last}</span></li>)}
          </ul>
        </div>
      )}
    </section>
  );
}
