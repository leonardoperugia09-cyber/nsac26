// Apple Health export (export.xml from the unzipped "Export All Health Data" file).
// The file is often over 1 GB, so it is scanned as text in chunks, never loaded into a DOM.
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

/** The record types HALO reads, by their short name in `counts`. */
const TYPES = {
  HKQuantityTypeIdentifierHeartRate: "heartRate",
  HKQuantityTypeIdentifierRestingHeartRate: "restingHeartRate",
  HKQuantityTypeIdentifierOxygenSaturation: "oxygenSaturation",
  HKQuantityTypeIdentifierBodyMass: "bodyMass",
  HKQuantityTypeIdentifierBodyTemperature: "bodyTemperature",
  HKCategoryTypeIdentifierSleepAnalysis: "sleepAnalysis",
} as const;
type Kind = (typeof TYPES)[keyof typeof TYPES];

export type AppleHealthImport = {
  measurements: Measurement[];
  /** First and last mission day that got a measurement, or null when nothing was imported */
  days: [number, number] | null;
  /** Records read per type, plus how many days were older than mission day 1 and left out */
  counts: Record<Kind | "daysBeforeMission", number>;
};

// One start tag; quoted attribute values may contain ">"
const RECORD = /<Record\s((?:[^>"']|"[^"]*"|'[^']*')*)>/g;
const ATTR = /(\w+)="([^"]*)"/g;

/** "2026-11-03 07:12:00 +0100" → milliseconds since epoch */
function parseAppleDate(s: string): number {
  const m =
    /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) ?([+-])(\d{2}):?(\d{2})$/.exec(s);
  return m
    ? Date.parse(`${m[1]}T${m[2]}${m[3]}${m[4]}:${m[5]}`)
    : Date.parse(s);
}

type Acc = { sum: number; n: number };

export async function parseAppleHealthExport(
  file: File | string,
  { crewId, currentDay }: { crewId: string; currentDay: number },
): Promise<AppleHealthImport> {
  const counts: AppleHealthImport["counts"] = {
    heartRate: 0,
    restingHeartRate: 0,
    oxygenSaturation: 0,
    bodyMass: 0,
    bodyTemperature: 0,
    sleepAnalysis: 0,
    daysBeforeMission: 0,
  };
  // Per calendar day ("YYYY-MM-DD" in the record's own time zone)
  const quantities = new Map<string, Partial<Record<Kind, Acc>>>();
  const sleep = new Map<string, [number, number][]>();

  const add = (date: string, kind: Kind, value: number) => {
    const day = quantities.get(date) ?? {};
    const acc = (day[kind] ??= { sum: 0, n: 0 });
    acc.sum += value;
    acc.n++;
    quantities.set(date, day);
  };

  const onRecord = (attrs: string) => {
    const a: Record<string, string> = {};
    for (const m of attrs.matchAll(ATTR)) a[m[1]] = m[2];
    const kind = TYPES[a.type as keyof typeof TYPES];
    if (!kind || !a.startDate) return;
    if (kind === "sleepAnalysis") {
      // Asleep, AsleepUnspecified, AsleepCore, AsleepDeep, AsleepREM count; InBed and Awake do not
      if (!a.value?.includes("Asleep") || !a.endDate) return;
      const start = parseAppleDate(a.startDate);
      const end = parseAppleDate(a.endDate);
      if (!(end > start)) return;
      counts.sleepAnalysis++;
      // A night belongs to the day you wake up
      const night = a.endDate.slice(0, 10);
      sleep.set(night, [...(sleep.get(night) ?? []), [start, end]]);
      return;
    }
    let v = Number(a.value);
    if (!Number.isFinite(v)) return;
    const unit = a.unit ?? "";
    if (kind === "oxygenSaturation" && v <= 1) v *= 100; // Apple stores 97 % as 0.97
    if (kind === "bodyMass")
      v = unit === "lb" ? v * LB_TO_KG : unit === "g" ? v / 1000 : v;
    if (kind === "bodyTemperature" && unit === "degF") v = fToC(v);
    counts[kind]++;
    add(a.startDate.slice(0, 10), kind, v);
  };

  const scan = (text: string) => {
    let end = 0;
    for (const m of text.matchAll(RECORD)) {
      onRecord(m[1]);
      end = m.index! + m[0].length;
    }
    return end;
  };

  if (typeof file === "string") scan(file);
  else {
    const reader = file.stream().getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
      const { done, value } = await reader.read();
      buffer += done
        ? decoder.decode()
        : decoder.decode(value, { stream: true });
      const end = scan(buffer);
      // Keep an unfinished record (or a tag cut in half) for the next chunk
      const open = buffer.indexOf("<Record", end);
      buffer =
        open >= 0
          ? buffer.slice(open)
          : buffer.slice(Math.max(end, buffer.length - 8));
      if (buffer.length > 1 << 20) buffer = buffer.slice(-8); // a broken tag must not hold the whole file
      if (done) break;
    }
  }

  // One value per calendar day and signal
  const daily = new Map<string, Partial<Record<InstrumentSignal, number>>>();
  const mean = (acc?: Acc) => (acc ? acc.sum / acc.n : undefined);
  for (const [date, q] of quantities) {
    const values = {
      heart_rate: mean(q.restingHeartRate) ?? mean(q.heartRate),
      spo2: mean(q.oxygenSaturation),
      body_mass_kg: mean(q.bodyMass),
      temp_c: mean(q.bodyTemperature),
    };
    daily.set(
      date,
      Object.fromEntries(
        Object.entries(values).filter(([, v]) => v !== undefined),
      ),
    );
  }
  for (const [night, intervals] of sleep) {
    // Watch and phone can log the same sleep twice: merge overlaps before adding up
    intervals.sort((x, y) => x[0] - y[0]);
    let total = 0;
    let [curStart, curEnd] = intervals[0];
    for (const [s, e] of intervals.slice(1)) {
      if (s <= curEnd) curEnd = Math.max(curEnd, e);
      else ((total += curEnd - curStart), ([curStart, curEnd] = [s, e]));
    }
    total += curEnd - curStart;
    daily.set(night, { ...daily.get(night), sleep_hours: total / 3_600_000 });
  }

  const dates = [...daily.keys()].sort();
  const newest = dates[dates.length - 1];
  const measurements: Measurement[] = [];
  for (const date of dates) {
    const missionDay = currentDay - daysBetween(newest, date);
    if (missionDay < MIN_DAY || missionDay > MAX_DAY) {
      counts.daysBeforeMission++;
      continue;
    }
    for (const [signal, raw] of Object.entries(daily.get(date)!) as [
      InstrumentSignal,
      number,
    ][]) {
      const value = roundFor(signal, raw);
      measurements.push({
        crewId,
        signal,
        value,
        unit: INSTRUMENT_UNITS[signal],
        sourceId: "Apple Health",
        provenance: "measured",
        observedAt: dayStart(date),
        missionDay,
        quality: qualityOf(signal, value),
      });
    }
  }
  const days = measurements.length
    ? ([
        measurements[0].missionDay,
        measurements[measurements.length - 1].missionDay,
      ] as [number, number])
    : null;
  return { measurements, days, counts };
}
