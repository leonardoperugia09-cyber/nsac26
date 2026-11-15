import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  connectHeartRate,
  parseBloodPressure,
  parseHeartRate,
  parseTemperature,
  parseWeight,
  readFloat,
  readSfloat,
} from "../../src/instruments/ble.ts";
import { startSimulatedStrap } from "../../src/instruments/simulated.ts";
import {
  guessMapping,
  parseCsv,
  parseDateKey,
  toMeasurements,
} from "../../src/instruments/csv.ts";
import { parseAppleHealthExport } from "../../src/instruments/appleHealth.ts";
import { INSTRUMENT_UNITS } from "../../src/instruments/types.ts";
import { UNITS } from "../node/contracts.ts";

const bytes = (...b: number[]) => new DataView(new Uint8Array(b).buffer);
const sample = (name: string) =>
  readFileSync(
    new URL(`../../public/samples/${name}`, import.meta.url),
    "utf8",
  );
const opts = { crewId: "C1", currentDay: 58, sourceId: "test" };
const byDay = (ms: { missionDay: number; signal: string; value: number }[]) => {
  const out: Record<number, Record<string, number>> = {};
  for (const m of ms) (out[m.missionDay] ??= {})[m.signal] = m.value;
  return out;
};

// ---- Bluetooth parsers ----

test("heart rate: uint8 value, no contact info, no RR", () => {
  assert.deepEqual(parseHeartRate(bytes(0x00, 72)), {
    bpm: 72,
    sensorContact: null,
    energyKj: null,
    rrIntervalsMs: [],
  });
});

test("heart rate: uint16 value with contact, energy and RR intervals in 1/1024 s", () => {
  // flags: uint16 | contact detected | contact supported | energy | RR
  const r = parseHeartRate(
    bytes(0x1f, 0x48, 0x00, 0x02, 0x01, 0x00, 0x04, 0x34, 0x03),
  );
  assert.equal(r.bpm, 72);
  assert.equal(r.sensorContact, true);
  assert.equal(r.energyKj, 0x0102);
  assert.deepEqual(r.rrIntervalsMs, [1000, 800.78125]);
  assert.equal(parseHeartRate(bytes(0x01, 0x2c, 0x01)).bpm, 300);
  assert.equal(parseHeartRate(bytes(0x04, 0)).sensorContact, false);
});

test("SFLOAT and FLOAT helpers decode exponents, negatives and special values", () => {
  assert.equal(readSfloat(bytes(0x78, 0x00), 0), 120);
  assert.equal(readSfloat(bytes(0xa0, 0xf0), 0), 16); // 160 x 10^-1
  assert.equal(readSfloat(bytes(0xff, 0xff), 0), -0.1);
  assert.ok(Number.isNaN(readSfloat(bytes(0xff, 0x07), 0)));
  assert.equal(readFloat(bytes(0x6f, 0x01, 0x00, 0xff), 0), 36.7);
  assert.ok(Number.isNaN(readFloat(bytes(0xff, 0xff, 0x7f, 0x00), 0)));
});

test("blood pressure in mmHg passes through", () => {
  const r = parseBloodPressure(bytes(0x00, 0x78, 0x00, 0x50, 0x00, 0x5d, 0x00));
  assert.deepEqual(r, {
    systolic: 120,
    diastolic: 80,
    meanArterial: 93,
    pulseRate: null,
    at: null,
  });
});

test("blood pressure in kPa converts to mmHg, with time stamp and pulse", () => {
  // 16.0 / 10.7 / 12.4 kPa, 2026-11-14 07:30:05, pulse 64
  const r = parseBloodPressure(
    bytes(
      0x07,
      0xa0,
      0xf0,
      0x6b,
      0xf0,
      0x7c,
      0xf0,
      0xea,
      0x07,
      11,
      14,
      7,
      30,
      5,
      0x40,
      0x00,
    ),
  );
  assert.equal(r.systolic, 120);
  assert.equal(r.diastolic, 80.3);
  assert.equal(r.meanArterial, 93);
  assert.equal(r.pulseRate, 64);
  assert.deepEqual(r.at, new Date(2026, 10, 14, 7, 30, 5));
});

test("temperature in Celsius and Fahrenheit ends up in degC", () => {
  assert.deepEqual(parseTemperature(bytes(0x00, 0x6f, 0x01, 0x00, 0xff)), {
    celsius: 36.7,
    at: null,
  });
  assert.equal(
    parseTemperature(bytes(0x01, 0xda, 0x03, 0x00, 0xff)).celsius,
    37,
  ); // 98.6 °F
});

test("weight in SI (0.005 kg) and imperial (0.01 lb) ends up in kg", () => {
  assert.equal(parseWeight(bytes(0x00, 0xb0, 0x36)).kg, 70); // 14000 x 0.005
  assert.equal(parseWeight(bytes(0x01, 0x48, 0x3c)).kg, 70); // 154.32 lb
  assert.ok(Number.isNaN(parseWeight(bytes(0x00, 0xff, 0xff)).kg));
});

test("connecting a strap without Web Bluetooth gives a clear error", async () => {
  await assert.rejects(
    connectHeartRate(() => {}),
    /Bluetooth needs Chrome or Edge on a computer/,
  );
});

test("simulated strap stays calm (62 to 72 bpm) and stops", async () => {
  const seen: number[] = [];
  const strap = startSimulatedStrap((bpm) => seen.push(bpm), 2);
  assert.equal(strap.name, "Simulated strap");
  assert.equal(seen.length, 1); // first value at once
  // wait for a few readings instead of a fixed delay, so a busy machine cannot make this flaky
  for (let waited = 0; seen.length <= 3 && waited < 2000; waited += 10)
    await new Promise((r) => setTimeout(r, 10));
  strap.stop();
  const count = seen.length;
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(seen.length, count);
  assert.ok(count > 3);
  assert.ok(seen.every((b) => Number.isInteger(b) && b >= 62 && b <= 72));
});

// ---- CSV ----

test("CSV parser handles quotes, semicolons, decimal commas, BOM and a preamble", () => {
  const t = parseCsv(
    '﻿Device export\r\n"Date";"Note";"Temp"\r\n2026-11-03;"says ""hi""; ok";36,7\r\n\r\n2026-11-04;;36,9\r\n',
  );
  assert.deepEqual(t.headers, ["Date", "Note", "Temp"]);
  assert.deepEqual(t.rows, [
    { Date: "2026-11-03", Note: 'says "hi"; ok', Temp: "36,7" },
    { Date: "2026-11-04", Note: "", Temp: "36,9" },
  ]);
  const r = toMeasurements(t.rows, guessMapping(t.headers), opts);
  assert.deepEqual(
    r.measurements.map((m) => [m.missionDay, m.value]),
    [
      [57, 36.7],
      [58, 36.9],
    ],
  );
});

test("guessMapping reads common header names and units", () => {
  const m = guessMapping([
    "Date",
    "Max HR",
    "Avg HR",
    "Resting HR",
    "SpO2 (%)",
    "Temperature (°F)",
    "Weight (lbs)",
    "BMI",
    "Systolic",
    "Diastolic",
    "Total Sleep Time (min)",
    "Sleep Efficiency (%)",
  ]);
  assert.equal(m.date, "Date");
  assert.equal(m.day, undefined);
  assert.deepEqual(m.columns, {
    "Resting HR": { signal: "heart_rate" },
    "SpO2 (%)": { signal: "spo2" },
    "Temperature (°F)": { signal: "temp_c", convert: "f_to_c" },
    "Weight (lbs)": { signal: "body_mass_kg", convert: "lb_to_kg" },
    Systolic: { signal: "bp_sys" },
    Diastolic: { signal: "bp_dia" },
    "Total Sleep Time (min)": {
      signal: "sleep_hours",
      convert: "minutes_to_hours",
    },
  });
  assert.deepEqual(guessMapping(["Mission Day", "heart rate", "oxygen"]), {
    date: undefined,
    day: "Mission Day",
    columns: {
      "heart rate": { signal: "heart_rate" },
      oxygen: { signal: "spo2" },
    },
  });
});

test("instrument signals and units match the backend contract, and short headers find all of them", () => {
  for (const [signal, unit] of Object.entries(INSTRUMENT_UNITS))
    assert.equal(UNITS[signal], unit);
  const all = guessMapping([
    "Date",
    "HR",
    "SpO2",
    "Temp",
    "Weight",
    "Systolic",
    "Diastolic",
    "Sleep",
  ]);
  assert.deepEqual(
    Object.values(all.columns)
      .map((c) => c.signal)
      .sort(),
    Object.keys(INSTRUMENT_UNITS).sort(),
  );
});

test("dates map to mission days: newest = current day, gaps kept, same-day rows averaged", () => {
  const rows = [
    { date: "2026-11-01", hr: "60" },
    { date: "2026-11-03", hr: "64" },
    { date: "2026-11-03", hr: "66" },
    { date: "2026-11-05", hr: "" },
    { date: "2026-11-04", hr: "70" },
    { date: "n/a", hr: "70" },
  ];
  const r = toMeasurements(
    rows,
    { date: "date", columns: { hr: { signal: "heart_rate" } } },
    { ...opts, currentDay: 10 },
  );
  assert.deepEqual(byDay(r.measurements), {
    6: { heart_rate: 60 },
    8: { heart_rate: 65 },
    9: { heart_rate: 70 },
  });
  assert.deepEqual(r.days, [6, 9]);
  assert.equal(r.skipped, 2); // no number on 11-05, no date on the last row
  const m = r.measurements[0];
  assert.deepEqual(m, {
    crewId: "C1",
    signal: "heart_rate",
    value: 60,
    unit: "bpm",
    sourceId: "test",
    provenance: "measured",
    observedAt: "2026-11-01T00:00:00.000Z",
    missionDay: 6,
    quality: "valid",
  });
});

test("a mission day column wins over dates; days outside 1-120 are skipped", () => {
  const rows = [
    { "Mission Day": "3", Sleep: "420" },
    { "Mission Day": "0", Sleep: "400" },
    { "Mission Day": "4", Sleep: "390" },
  ];
  const r = toMeasurements(rows, guessMapping(["Mission Day", "Sleep"]), opts);
  // No unit in the header: values above 24 are read as minutes
  assert.deepEqual(byDay(r.measurements), {
    3: { sleep_hours: 7 },
    4: { sleep_hours: 6.5 },
  });
  assert.equal(r.skipped, 1);
  assert.equal(r.measurements[0].observedAt, undefined);
});

test("older dates than mission day 1 are skipped; implausible values are suspect", () => {
  const rows = [
    { d: "2026-11-01", hr: "61" },
    { d: "2026-11-02", hr: "62" },
    { d: "2026-11-03", hr: "0" },
  ];
  const r = toMeasurements(
    rows,
    { date: "d", columns: { hr: { signal: "heart_rate" } } },
    { ...opts, currentDay: 2 },
  );
  assert.deepEqual(byDay(r.measurements), {
    1: { heart_rate: 62 },
    2: { heart_rate: 0 },
  });
  assert.equal(r.measurements[1].quality, "suspect");
  assert.equal(r.skipped, 1);
});

test("date formats: ISO, US month first, European day first", () => {
  assert.equal(parseDateKey("2026-11-03 07:12:00"), "2026-11-03");
  assert.equal(parseDateKey("11/03/2026"), "2026-11-03");
  assert.equal(parseDateKey("03.11.2026"), "2026-11-03");
  assert.equal(parseDateKey("13/03/26"), "2026-03-13");
  assert.equal(parseDateKey("12/03/2026", true), "2026-03-12");
  assert.equal(parseDateKey("yesterday"), null);
  // One day-first date in the column makes the whole column day-first
  const rows = [
    { Date: "12/03/2026", HR: "60" },
    { Date: "13/03/2026", HR: "62" },
  ];
  assert.deepEqual(
    byDay(
      toMeasurements(rows, guessMapping(["Date", "HR"]), opts).measurements,
    ),
    {
      57: { heart_rate: 60 },
      58: { heart_rate: 62 },
    },
  );
});

test("Actiwatch sample: preset found, sleep minutes become hours on the wake-up day", () => {
  const t = parseCsv(sample("actiwatch-sample.csv"));
  const mapping = guessMapping(t.headers);
  assert.equal(mapping.preset, "actiwatch");
  const r = toMeasurements(t.rows, mapping, { ...opts, sourceId: "Actiwatch" });
  assert.deepEqual(r.days, [49, 58]);
  assert.equal(r.skipped, 0);
  assert.equal(r.measurements.length, 10);
  const days = byDay(r.measurements);
  assert.equal(days[55].sleep_hours, 5.1); // the short night: 306 min
  assert.equal(days[58].sleep_hours, 7.25); // 435 min
  assert.equal(r.measurements[9].observedAt, "2026-11-12T00:00:00.000Z");
});

test("Hexoskin sample: preset found, resting heart rate and sleep per day; mapping can be overridden", () => {
  const t = parseCsv(sample("hexoskin-sample.csv"));
  const mapping = guessMapping(t.headers);
  assert.equal(mapping.preset, "hexoskin");
  const r = toMeasurements(t.rows, mapping, opts);
  assert.deepEqual(r.days, [49, 58]);
  assert.deepEqual(byDay(r.measurements)[49], {
    heart_rate: 58,
    sleep_hours: 7.08,
  });
  const avg = toMeasurements(
    t.rows,
    { date: "date", columns: { "heart_rate [bpm]": { signal: "heart_rate" } } },
    opts,
  );
  assert.equal(byDay(avg.measurements)[49].heart_rate, 67.2);
});

// ---- Apple Health ----

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE HealthData [
<!ATTLIST Record type CDATA #REQUIRED>
]>
<HealthData locale="en_US">
 <Record type="HKQuantityTypeIdentifierHeartRate" sourceName="Watch" unit="count/min" startDate="2026-11-09 18:00:00 +0100" endDate="2026-11-09 18:00:00 +0100" value="80"/>
 <Record type="HKQuantityTypeIdentifierHeartRate" sourceName="Watch" unit="count/min" startDate="2026-11-10 08:00:00 +0100" endDate="2026-11-10 08:00:00 +0100" value="60">
  <MetadataEntry key="HKMetadataKeyHeartRateMotionContext" value="1"/>
 </Record>
 <Record type="HKQuantityTypeIdentifierHeartRate" sourceName="Watch" unit="count/min" startDate="2026-11-10 12:00:00 +0100" endDate="2026-11-10 12:00:00 +0100" value="70"/>
 <Record type="HKQuantityTypeIdentifierOxygenSaturation" sourceName="Watch" unit="%" startDate="2026-11-10 03:00:00 +0100" endDate="2026-11-10 03:00:00 +0100" value="0.95"/>
 <Record type="HKQuantityTypeIdentifierOxygenSaturation" sourceName="Watch" unit="%" startDate="2026-11-10 04:00:00 +0100" endDate="2026-11-10 04:00:00 +0100" value="0.97"/>
 <Record type="HKQuantityTypeIdentifierBodyMass" sourceName="Scale" unit="lb" startDate="2026-11-10 07:00:00 +0100" endDate="2026-11-10 07:00:00 +0100" value="154.32"/>
 <Record type="HKQuantityTypeIdentifierBodyTemperature" sourceName="Crew’s thermometer > app" unit="degF" startDate="2026-11-10 07:05:00 +0100" endDate="2026-11-10 07:05:00 +0100" value="98.6"/>
 <Record type="HKQuantityTypeIdentifierStepCount" sourceName="Phone" unit="count" startDate="2026-11-10 09:00:00 +0100" endDate="2026-11-10 10:00:00 +0100" value="1200"/>
 <Record type="HKCategoryTypeIdentifierSleepAnalysis" sourceName="Phone" startDate="2026-11-09 22:30:00 +0100" endDate="2026-11-10 07:00:00 +0100" value="HKCategoryValueSleepAnalysisInBed"/>
 <Record type="HKCategoryTypeIdentifierSleepAnalysis" sourceName="Watch" startDate="2026-11-09 23:00:00 +0100" endDate="2026-11-10 03:00:00 +0100" value="HKCategoryValueSleepAnalysisAsleepCore"/>
 <Record type="HKCategoryTypeIdentifierSleepAnalysis" sourceName="Other app" startDate="2026-11-10 02:00:00 +0100" endDate="2026-11-10 06:30:00 +0100" value="HKCategoryValueSleepAnalysisAsleepUnspecified"/>
 <Record type="HKCategoryTypeIdentifierSleepAnalysis" sourceName="Watch" startDate="2026-11-10 06:30:00 +0100" endDate="2026-11-10 06:40:00 +0100" value="HKCategoryValueSleepAnalysisAwake"/>
</HealthData>`;

/** A File-like object whose stream arrives in small byte chunks (splits tags and multi-byte characters). */
const chunked = (text: string, size: number) => {
  const data = new TextEncoder().encode(text);
  return {
    stream: () =>
      new ReadableStream<Uint8Array>({
        start(c) {
          for (let i = 0; i < data.length; i += size)
            c.enqueue(data.slice(i, i + size));
          c.close();
        },
      }),
  } as unknown as File;
};

test("Apple Health: unit conversions, heart-rate fallback, overlapping sleep merged", async () => {
  const r = await parseAppleHealthExport(xml, { crewId: "C2", currentDay: 20 });
  assert.deepEqual(byDay(r.measurements), {
    19: { heart_rate: 80 },
    // lb → kg, °F → °C, 0.95/0.97 → 96 %, mean of all heart rates (no resting record),
    // sleep 23:00-03:00 and 02:00-06:30 overlap: 7.5 h, not 8.5 h; in bed and awake do not count
    20: {
      heart_rate: 65,
      spo2: 96,
      body_mass_kg: 70,
      temp_c: 37,
      sleep_hours: 7.5,
    },
  });
  assert.deepEqual(r.days, [19, 20]);
  assert.deepEqual(r.counts, {
    heartRate: 3,
    restingHeartRate: 0,
    oxygenSaturation: 2,
    bodyMass: 1,
    bodyTemperature: 1,
    sleepAnalysis: 2,
    daysBeforeMission: 0,
  });
  for (const m of r.measurements) {
    assert.equal(m.crewId, "C2");
    assert.equal(m.sourceId, "Apple Health");
    assert.equal(m.provenance, "measured");
    assert.equal(UNITS[m.signal], m.unit);
  }
});

test("Apple Health: streaming a File in tiny chunks gives the same result as a string", async () => {
  const fromString = await parseAppleHealthExport(xml, {
    crewId: "C2",
    currentDay: 20,
  });
  assert.deepEqual(
    await parseAppleHealthExport(chunked(xml, 7), {
      crewId: "C2",
      currentDay: 20,
    }),
    fromString,
  );
  const text = sample("apple-health-sample.xml");
  assert.deepEqual(
    await parseAppleHealthExport(chunked(text, 1000), opts),
    await parseAppleHealthExport(text, opts),
  );
});

test("Apple Health sample: 10 days, resting heart rate preferred, all values plausible", async () => {
  const r = await parseAppleHealthExport(
    sample("apple-health-sample.xml"),
    opts,
  );
  assert.deepEqual(r.days, [49, 58]);
  assert.equal(r.counts.restingHeartRate, 10);
  assert.equal(r.counts.heartRate, 60);
  const days = byDay(r.measurements);
  assert.deepEqual(days[58], {
    heart_rate: 65,
    spo2: 97,
    body_mass_kg: 71.8,
    temp_c: 36.6,
    sleep_hours: 7.32,
  });
  assert.equal(days[55].sleep_hours, 5.24); // the short night
  assert.ok(r.measurements.every((m) => m.quality === "valid"));
  assert.equal(
    r.measurements.find((m) => m.missionDay === 58)!.observedAt,
    "2026-11-12T00:00:00.000Z",
  );
});

test("Apple Health: days before mission day 1 are left out and counted", async () => {
  const r = await parseAppleHealthExport(sample("apple-health-sample.xml"), {
    crewId: "C1",
    currentDay: 3,
  });
  assert.deepEqual(r.days, [1, 3]);
  assert.equal(r.counts.daysBeforeMission, 7);
});
