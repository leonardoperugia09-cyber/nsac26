import { readFileSync } from "node:fs";
const historical = JSON.parse(
  readFileSync(new URL("../resources/radiation.json", import.meta.url), "utf8"),
);
export function radiationCache(record: any = historical, now = Date.now()) {
  const age = (now - Date.parse(record.observed_at)) / 1000;
  return {
    status: age > 3600 ? "stale" : "cached",
    ageSeconds: age,
    snapshot: record,
    live: false,
    notice:
      "Instrument absorbed dose rate is not personal effective dose. No conversion to mSv/day is assumed.",
  };
}
export async function fetchRadiation(
  start: string,
  end: string,
  instrument = "DosTel1",
) {
  const lo = Date.parse(start),
    hi = Date.parse(end);
  if (
    !Number.isFinite(lo) ||
    !Number.isFinite(hi) ||
    hi <= lo ||
    hi - lo > 3600000 ||
    hi > Date.now() ||
    !/^[\w-]{1,80}$/.test(instrument)
  )
    throw Error("Invalid bounded radiation query");
  const url = new URL("https://visualization.osdr.nasa.gov/radlab/api/");
  for (const [k, v] of Object.entries({
    spacecraft: "ISS",
    instrument_id: instrument,
    "timestamp>": new Date(lo).toISOString().slice(0, 19),
    "timestamp<": new Date(hi).toISOString().slice(0, 19),
    absorbed_dose_rate: "",
    module: "",
    format: "json",
  }))
    url.searchParams.set(k, v);
  const response = await fetch(url, {
    signal: AbortSignal.timeout(15000),
    redirect: "error",
  });
  if (!response.ok || !response.body) throw Error("NASA provider unavailable");
  const reader = response.body.getReader();
  let text = "";
  let bytes = 0;
  const decoder = new TextDecoder();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 1000000) throw Error("Provider response too large");
      text += decoder.decode(value, { stream: true });
    }
  } finally {
    await reader.cancel();
  }
  text += decoder.decode();
  const body = JSON.parse(text);
  if (!Array.isArray(body.columns) || !Array.isArray(body.data))
    throw Error("Unexpected provider response");
  const needed = [
    "timestamp",
    "instrument_id",
    "absorbed_dose_rate",
    "module",
    "spacecraft",
  ];
  if (
    needed.some((k) => !body.columns.includes(k)) ||
    new Set(body.columns).size !== body.columns.length
  )
    throw Error("Unexpected provider columns");
  const rows = body.data
    .map((r: any[]) => {
      if (!Array.isArray(r) || r.length !== body.columns.length)
        throw Error("Malformed row");
      return Object.fromEntries(
        body.columns.map((k: string, i: number) => [k, r[i]]),
      );
    })
    .filter((r: any) => r.absorbed_dose_rate !== null);
  for (const r of rows) {
    if (
      r.instrument_id !== instrument ||
      r.spacecraft !== "ISS" ||
      typeof r.absorbed_dose_rate !== "number" ||
      !Number.isFinite(r.absorbed_dose_rate) ||
      r.absorbed_dose_rate < 0
    )
      throw Error("Invalid instrument/dose");
    r.time = Date.parse(
      /[zZ]|[+-]\d\d:\d\d$/.test(r.timestamp) ? r.timestamp : r.timestamp + "Z",
    );
  }
  const valid = rows
    .filter((r: any) => r.time >= lo && r.time <= hi)
    .sort((a: any, b: any) => b.time - a.time);
  if (!valid.length) throw Error("No observations in interval");
  const r = valid[0];
  return {
    schema_version: "1.0",
    source_url: url.toString(),
    instrument,
    location: `ISS/${r.module}`,
    quantity: "absorbed_dose_rate",
    unit: "uGy/h",
    value: r.absorbed_dose_rate,
    observed_at: new Date(r.time).toISOString(),
    fetched_at: new Date().toISOString(),
    provenance: "measured",
    timestamp_basis: /[zZ]|[+-]\d\d:\d\d$/.test(r.timestamp)
      ? "explicit_offset"
      : "upstream_naive_assumed_utc",
  };
}
