import test from "node:test";
import assert from "node:assert/strict";
import { fetchRadiation } from "../node/radiation.ts";
import { evidenceBundle, evidence } from "../node/evidence.ts";
import { loadDataset } from "../node/data.ts";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
test("NASA shape is validated and absorbed dose units are retained", async () => {
  const old = global.fetch;
  global.fetch = async () =>
    new Response(
      JSON.stringify({
        columns: [
          "timestamp",
          "instrument_id",
          "absorbed_dose_rate",
          "module",
          "spacecraft",
        ],
        data: [["2022-04-01T23:01:00", "DosTel1", 5, "Columbus", "ISS"]],
      }),
    );
  try {
    const r = await fetchRadiation(
      "2022-04-01T23:00:00Z",
      "2022-04-01T23:05:00Z",
    );
    assert.equal(r.unit, "uGy/h");
    assert.equal(r.quantity, "absorbed_dose_rate");
    assert.equal(r.location, "ISS/Columbus");
  } finally {
    global.fetch = old;
  }
});
test("invalid NASA response and unbounded queries are rejected", async () => {
  const old = global.fetch;
  global.fetch = async () => new Response("{}");
  try {
    await assert.rejects(
      fetchRadiation("2022-04-01T23:00:00Z", "2022-04-01T23:05:00Z"),
    );
    await assert.rejects(
      fetchRadiation("2022-04-01T00:00:00Z", "2022-04-02T00:00:00Z"),
    );
  } finally {
    global.fetch = old;
  }
});
test("source registry resolves all rule references and never claims clinical approval", () => {
  const b = evidenceBundle();
  assert.match(b.sha256, /^[a-f0-9]{64}$/);
  assert.equal(evidence.length, 46);
  assert.ok(evidence.every((e: any) => e.clinically_approved === false));
});
test("corrupt dataset cannot masquerade as healthy demo data", () => {
  const dir = mkdtempSync(join(tmpdir(), "halo-data-"));
  try {
    writeFileSync(join(dir, "data.json"), "{}");
    assert.throws(() => loadDataset(join(dir, "data.json")));
  } finally {
    rmSync(dir, { recursive: true });
  }
});
