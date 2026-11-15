// CSV exports from wearables (Actiwatch, Hexoskin, any spreadsheet): read the table, guess which column
// is which HALO signal, then turn the rows into one Measurement per day and signal.
import {
  INSTRUMENT_UNITS,
  LB_TO_KG,
  MAX_DAY,
  MIN_DAY,
  dayStart,
  daysBetween,
  fToC,
  qualityOf,
  roundFor,
  type InstrumentSignal,
  type Measurement,
} from "./types.ts";

export type CsvTable = { headers: string[]; rows: Record<string, string>[] };

/** Conversions a column may need before its value is in HALO units. */
export type Conversion =
  | "minutes_to_hours"
  | "f_to_c"
  | "lb_to_kg"
  | "fraction_to_percent"
  | "kpa_to_mmhg";
export type ColumnTarget = { signal: InstrumentSignal; convert?: Conversion };
export type PresetId = "actiwatch" | "hexoskin";
export type ColumnMapping = {
  /** Header of the date column */
  date?: string;
  /** Header of a mission-day column; when set it decides the mission day instead of the date */
  day?: string;
  /** Header → signal. Override freely: the guesses and presets are not verified against real exports. */
  columns: Record<string, ColumnTarget>;
  /** Set when the headers matched a known device preset */
  preset?: PresetId;
};

const CONVERT: Record<Conversion, (v: number) => number> = {
  minutes_to_hours: (v) => v / 60,
  f_to_c: fToC,
  lb_to_kg: (v) => v * LB_TO_KG,
  fraction_to_percent: (v) => v * 100,
  kpa_to_mmhg: (v) => v * 7.50062,
};

/** Reads CSV text: quoted fields, commas, semicolons or tabs. Lines above the header (device preambles) are skipped. */
export function parseCsv(text: string): CsvTable {
  text = text.replace(/^﻿/, "");
  const records = splitRecords(text, detectDelimiter(text));
  const width = Math.max(0, ...records.slice(0, 50).map((r) => r.length));
  const h = records.findIndex(
    (r) => r.length === width && r.some((c) => c.trim()),
  );
  if (h < 0) return { headers: [], rows: [] };
  const headers = records[h].map((c) => c.trim());
  const rows = records
    .slice(h + 1)
    .filter((r) => r.some((c) => c.trim()))
    .map((r) =>
      Object.fromEntries(headers.map((k, i) => [k, (r[i] ?? "").trim()])),
    );
  return { headers, rows };
}

/** The delimiter that appears most often (outside quotes) in the first line that has any. Ties prefer ; then tab. */
function detectDelimiter(text: string): string {
  const candidates = [";", "\t", ","];
  for (const line of text.split(/\r?\n/, 30)) {
    const unquoted = line.replace(/"[^"]*"/g, "");
    const counts = candidates.map((d) => unquoted.split(d).length - 1);
    const best = Math.max(...counts);
    if (best > 0) return candidates[counts.indexOf(best)];
  }
  return ",";
}

function splitRecords(text: string, delim: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') ((field += '"'), i++);
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === delim) (row.push(field), (field = ""));
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      (row.push(field), out.push(row), (row = []), (field = ""));
    } else field += c;
  }
  if (field || row.length) (row.push(field), out.push(row));
  return out;
}

const norm = (h: string) =>
  h
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const tokens = (h: string) => norm(h).split(" ");

/** Score how well a header fits a signal (0 = not at all). Higher wins when several columns fit. */
function scoreHeader(
  header: string,
): { signal: InstrumentSignal; score: number; convert?: Conversion } | null {
  const n = norm(header);
  const t = tokens(header);
  const has = (...words: string[]) => words.some((w) => t.includes(w));
  const raw = header.toLowerCase();
  if (/spo2|oxygen|o2 sat|saturation|pulse ox/.test(n))
    return {
      signal: "spo2",
      score: 1,
      convert: has("fraction") ? "fraction_to_percent" : undefined,
    };
  if (/heart rate|\bhr\b|\bbpm\b|pulse|\brhr\b/.test(n)) {
    if (has("max", "min", "peak", "variability", "reserve", "zone", "recovery"))
      return null;
    return {
      signal: "heart_rate",
      score: /resting|\brest\b|\brhr\b/.test(n)
        ? 3
        : has("avg", "mean", "average")
          ? 2
          : 1,
    };
  }
  if (/temp/.test(n) && !/ambient|room|environment/.test(n))
    return {
      signal: "temp_c",
      score: 1,
      convert:
        has("f", "degf", "fahrenheit") || /°f/.test(raw) ? "f_to_c" : undefined,
    };
  if (/weight|mass/.test(n) && !/index|bmi|fat|lean|muscle|bone|water/.test(n))
    return {
      signal: "body_mass_kg",
      score: 1,
      convert: has("lb", "lbs", "pound", "pounds") ? "lb_to_kg" : undefined,
    };
  const kpa = has("kpa") ? ("kpa_to_mmhg" as const) : undefined;
  if (/systolic|\bsys\b|\bsbp\b/.test(n))
    return { signal: "bp_sys", score: 1, convert: kpa };
  if (/diastolic|\bdia\b|\bdbp\b/.test(n))
    return { signal: "bp_dia", score: 1, convert: kpa };
  if (
    (/sleep/.test(n) || has("tst")) &&
    !/efficien|latency|onset|offset|start|end|wake|quality|score/.test(n) &&
    !raw.includes("%")
  )
    return {
      signal: "sleep_hours",
      score: /total|duration|time|tst/.test(n) ? 2 : 1,
      convert: has("min", "mins", "minutes") ? "minutes_to_hours" : undefined,
    };
  return null;
}

function dateScore(header: string): number {
  const n = norm(header);
  if (/update|created|birth/.test(n)) return 0;
  if (n === "date") return 4;
  if (/date/.test(n)) return /end|wake/.test(n) ? 3 : 2;
  if (/^(timestamp|time stamp|datetime|night|calendar day)$/.test(n)) return 1;
  return 0;
}
const isDayHeader = (header: string) =>
  /^(mission day|flight day|fd|md)$/.test(norm(header));

/** Known device exports. Column names come from public examples, not from a verified export: check them. */
export const PRESETS: Record<
  PresetId,
  { label: string; mapping: ColumnMapping }
> = {
  actiwatch: {
    label: "Actiwatch (Actiware sleep intervals)",
    // Sleep belongs to the day you wake up, so the end date decides the day
    mapping: {
      date: "End Date",
      columns: {
        "Sleep Time": { signal: "sleep_hours", convert: "minutes_to_hours" },
      },
    },
  },
  hexoskin: {
    label: "Hexoskin (daily summary)",
    mapping: {
      date: "date",
      columns: {
        "resting_heart_rate [bpm]": { signal: "heart_rate" },
        "sleep_duration [min]": {
          signal: "sleep_hours",
          convert: "minutes_to_hours",
        },
      },
    },
  },
};

/** Guess which column is which: a device preset when all its columns are present, otherwise by header names. */
export function guessMapping(headers: string[]): ColumnMapping {
  for (const id of Object.keys(PRESETS) as PresetId[]) {
    const m = PRESETS[id].mapping;
    const needed = [m.date, ...Object.keys(m.columns)].filter(Boolean);
    if (needed.every((h) => headers.includes(h!)))
      return { ...m, columns: { ...m.columns }, preset: id };
  }
  const best = new Map<
    InstrumentSignal,
    { header: string; score: number; convert?: Conversion }
  >();
  let date: { header: string; score: number } | undefined;
  let day: string | undefined;
  let bareDay: string | undefined; // a plain "Day" column may hold weekday names, so it only counts without a date
  for (const header of headers) {
    if (!day && isDayHeader(header)) {
      day = header;
      continue;
    }
    if (norm(header) === "day") {
      bareDay = header;
      continue;
    }
    const ds = dateScore(header);
    if (ds > (date?.score ?? 0)) date = { header, score: ds };
    if (ds) continue;
    const s = scoreHeader(header);
    if (s && s.score > (best.get(s.signal)?.score ?? 0))
      best.set(s.signal, { header, ...s });
  }
  const columns: Record<string, ColumnTarget> = {};
  for (const [signal, { header, convert }] of best)
    columns[header] = convert ? { signal, convert } : { signal };
  return {
    date: date?.header,
    day: day ?? (date ? undefined : bareDay),
    columns,
  };
}

/** Reads "1,5" as 1.5 when the file uses a decimal comma. Empty or text cells give null. */
function parseNumber(s: string): number | null {
  const m = /^([-+]?\d+(?:[.,]\d+)?)\s*%?$/.exec(s.trim());
  return m ? Number(m[1].replace(",", ".")) : null;
}

/** "2026-11-03", "2026-11-03 07:12", "11/03/2026" (US), "03.11.2026" or "13/03/2026" (day first) → "YYYY-MM-DD". */
export function parseDateKey(s: string, dayFirst = false): string | null {
  const v = s.trim();
  let y: number, mo: number, d: number;
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(v);
  if (m) [y, mo, d] = [+m[1], +m[2], +m[3]];
  else if ((m = /^(\d{1,2})([/.-])(\d{1,2})\2(\d{2,4})/.exec(v))) {
    const first = dayFirst || m[2] === "." || +m[1] > 12;
    [d, mo] = first ? [+m[1], +m[3]] : [+m[3], +m[1]];
    y = m[4].length === 2 ? 2000 + +m[4] : +m[4];
  } else return null;
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** When the value alone shows the unit (sleep in minutes, °F, a 0-1 fraction), convert even without a hint in the header. */
function autoConvert(
  signal: InstrumentSignal,
  median: number,
): Conversion | undefined {
  if (signal === "sleep_hours" && median > 24) return "minutes_to_hours";
  if (signal === "temp_c" && median > 50) return "f_to_c";
  if (signal === "spo2" && median <= 1) return "fraction_to_percent";
  return undefined;
}

export type CsvImport = {
  measurements: Measurement[];
  /** First and last mission day that got a measurement, or null when nothing was imported */
  days: [number, number] | null;
  /** Rows without a usable date or day, outside mission days 1-120, or without any number in a mapped column */
  skipped: number;
};

/**
 * Turn CSV rows into one Measurement per mission day and signal (the mean of that day's rows).
 * Without a day column the newest date becomes currentDay and earlier dates count backwards.
 */
export function toMeasurements(
  rows: Record<string, string>[],
  mapping: ColumnMapping,
  {
    crewId,
    currentDay,
    sourceId,
  }: { crewId: string; currentDay: number; sourceId: string },
): CsvImport {
  const { date, day, columns } = mapping;
  const dayFirst =
    !!date &&
    rows.some((r) => Number(/^(\d{1,2})[/-]/.exec(r[date] ?? "")?.[1]) > 12);
  const keyed = rows.map((r) => ({
    r,
    date: date ? parseDateKey(r[date] ?? "", dayFirst) : null,
  }));
  const newest = keyed.reduce<string | null>(
    (max, k) => (k.date && (!max || k.date > max) ? k.date : max),
    null,
  );

  const conversions = new Map<string, Conversion | undefined>();
  for (const [header, target] of Object.entries(columns)) {
    const values = rows
      .map((r) => parseNumber(r[header] ?? ""))
      .filter((v): v is number => v !== null);
    const median = values.sort((a, b) => a - b)[Math.floor(values.length / 2)];
    conversions.set(
      header,
      target.convert ??
        (values.length ? autoConvert(target.signal, median) : undefined),
    );
  }

  const sums = new Map<
    string,
    {
      day: number;
      signal: InstrumentSignal;
      date: string | null;
      sum: number;
      n: number;
    }
  >();
  let skipped = 0;
  for (const { r, date: dateKey } of keyed) {
    const missionDay = day
      ? parseNumber(r[day] ?? "")
      : dateKey && newest
        ? currentDay - daysBetween(newest, dateKey)
        : null;
    if (
      missionDay === null ||
      !Number.isInteger(missionDay) ||
      missionDay < MIN_DAY ||
      missionDay > MAX_DAY
    ) {
      skipped++;
      continue;
    }
    let used = false;
    for (const [header, { signal }] of Object.entries(columns)) {
      const v = parseNumber(r[header] ?? "");
      if (v === null) continue;
      const convert = conversions.get(header);
      const value = convert ? CONVERT[convert](v) : v;
      const key = `${missionDay}:${signal}`;
      const acc = sums.get(key) ?? {
        day: missionDay,
        signal,
        date: dateKey,
        sum: 0,
        n: 0,
      };
      acc.sum += value;
      acc.n++;
      sums.set(key, acc);
      used = true;
    }
    if (!used) skipped++;
  }

  const measurements: Measurement[] = [...sums.values()]
    .sort((a, b) => a.day - b.day || a.signal.localeCompare(b.signal))
    .map(({ day: missionDay, signal, date: dateKey, sum, n }) => {
      const value = roundFor(signal, sum / n);
      return {
        crewId,
        signal,
        value,
        unit: INSTRUMENT_UNITS[signal],
        sourceId,
        provenance: "measured" as const,
        ...(dateKey ? { observedAt: dayStart(dateKey) } : {}),
        missionDay,
        quality: qualityOf(signal, value),
      };
    });
  const days = measurements.length
    ? ([
        measurements[0].missionDay,
        measurements[measurements.length - 1].missionDay,
      ] as [number, number])
    : null;
  return { measurements, days, skipped };
}
