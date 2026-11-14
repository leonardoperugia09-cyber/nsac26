import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { COUPLING_RULES } from "../../src/rules/index.ts";
const raw = JSON.parse(
  readFileSync(new URL("../resources/evidence.json", import.meta.url), "utf8"),
);
const aliases: Record<string, string> = {
  nasa_human_body: "nasa_body",
  siew_kidney_2024: "kidney_2024",
  du_pharmaceuticals_2011: "drug_2011",
};
export const evidence = raw.records.map((r: any) => ({
  ...r,
  id: aliases[r.id] ?? r.id, // sources without an alias keep their own id (they were coming back with none)
  sourceId: r.id,
  review_status: "domain_review_pending",
  clinically_approved: false,
}));
export function evidenceBundle() {
  const manifest = { version: "halo-evidence-2.0", records: evidence };
  return {
    manifest,
    sha256: createHash("sha256").update(JSON.stringify(manifest)).digest("hex"),
    algorithm: "sha256-json-utf8-insertion-order",
    notice: "Checksum is content identity, not proof of scientific validity.",
  };
}
export const protocols = COUPLING_RULES.map((r) => ({
  id: r.id,
  title: r.name,
  requiredSignals: Object.keys(r.signals),
  additionalInputs: r.needs ?? [],
  source: r.source,
  action:
    "Review measurements and symptoms with the crew medical officer and follow the approved mission protocol.",
  status: "demonstration_review_required",
  approved: false,
}));
