// FHIR R4 export: one day's readings as Observation resources in a searchset Bundle.
// Vital signs use LOINC codes and UCUM units (https://build.fhir.org/observation-vitalsigns.html);
// every other HALO signal uses a local code system so nothing is mislabelled as a LOINC concept.
// Shared by the HALO server (GET /api/fhir/Observation) and the app, so the export also works offline.

const LOINC = "http://loinc.org";
const UCUM = "http://unitsofmeasure.org";
const HALO = "urn:halo:signal";
const VITALS = {
  system: "http://terminology.hl7.org/CodeSystem/observation-category",
  code: "vital-signs",
  display: "Vital Signs",
};

const VITAL_CODES: Record<
  string,
  { code: string; display: string; ucum: string }
> = {
  heart_rate: { code: "8867-4", display: "Heart rate", ucum: "/min" },
  spo2: {
    code: "2708-6",
    display: "Oxygen saturation in Arterial blood",
    ucum: "%",
  },
  temp_c: { code: "8310-5", display: "Body temperature", ucum: "Cel" },
  body_mass_kg: { code: "29463-7", display: "Body weight", ucum: "kg" },
};

type Reading = {
  signal: string;
  value: number;
  source: string;
  simulated: boolean;
  at?: string;
};

const quantity = (value: number, ucum: string) => ({
  value,
  unit: ucum,
  system: UCUM,
  code: ucum,
});

function observation(
  crewId: string,
  name: string,
  day: number,
  r: Reading,
  i: number,
  units: Record<string, string>,
) {
  const vital = VITAL_CODES[r.signal];
  return {
    resourceType: "Observation",
    id: `${crewId}-d${day}-${r.signal}-${i}`,
    meta: r.simulated
      ? { tag: [{ system: "urn:halo:provenance", code: "simulated" }] }
      : undefined,
    status: "final",
    category: vital ? [{ coding: [VITALS] }] : undefined,
    code: vital
      ? {
          coding: [{ system: LOINC, code: vital.code, display: vital.display }],
          text: vital.display,
        }
      : { coding: [{ system: HALO, code: r.signal }], text: r.signal },
    subject: {
      display: name,
      identifier: { system: "urn:halo:crew", value: crewId },
    },
    effectiveDateTime: r.at,
    extension: [{ url: "urn:halo:mission-day", valueInteger: day }],
    device: { display: r.source },
    valueQuantity: vital
      ? quantity(r.value, vital.ucum)
      : { value: r.value, unit: units[r.signal] },
  };
}

function bloodPressure(
  crewId: string,
  name: string,
  day: number,
  sys: Reading,
  dia: Reading,
) {
  return {
    resourceType: "Observation",
    id: `${crewId}-d${day}-bp`,
    meta: sys.simulated
      ? { tag: [{ system: "urn:halo:provenance", code: "simulated" }] }
      : undefined,
    status: "final",
    category: [{ coding: [VITALS] }],
    code: {
      coding: [
        { system: LOINC, code: "85354-9", display: "Blood pressure panel" },
      ],
      text: "Blood pressure",
    },
    subject: {
      display: name,
      identifier: { system: "urn:halo:crew", value: crewId },
    },
    effectiveDateTime: sys.at,
    extension: [{ url: "urn:halo:mission-day", valueInteger: day }],
    device: { display: sys.source },
    component: [
      {
        code: {
          coding: [
            {
              system: LOINC,
              code: "8480-6",
              display: "Systolic blood pressure",
            },
          ],
        },
        valueQuantity: quantity(sys.value, "mm[Hg]"),
      },
      {
        code: {
          coding: [
            {
              system: LOINC,
              code: "8462-4",
              display: "Diastolic blood pressure",
            },
          ],
        },
        valueQuantity: quantity(dia.value, "mm[Hg]"),
      },
    ],
  };
}

/** Instrument readings win over the simulated reading for the same signal. */
export function fhirBundle(
  name: string,
  crewId: string,
  day: number,
  measured: any[],
  simulated: Record<string, unknown> | undefined,
  units: Record<string, string>,
) {
  const bySignal = new Map<string, Reading>();
  if (simulated)
    for (const signal of Object.keys(units)) {
      const v = simulated[signal];
      if (typeof v === "number" && Number.isFinite(v))
        bySignal.set(signal, {
          signal,
          value: v,
          source: "HALO crew simulator",
          simulated: true,
        });
    }
  for (const m of measured)
    if (m.value != null && m.quality !== "invalid")
      bySignal.set(m.signal, {
        signal: m.signal,
        value: m.value,
        source: m.sourceId,
        simulated: m.provenance === "simulated",
        at: m.observedAt,
      });

  const resources: any[] = [];
  const sys = bySignal.get("bp_sys"),
    dia = bySignal.get("bp_dia");
  if (sys && dia) resources.push(bloodPressure(crewId, name, day, sys, dia));
  let i = 0;
  for (const r of bySignal.values())
    if (r.signal !== "bp_sys" && r.signal !== "bp_dia")
      resources.push(observation(crewId, name, day, r, i++, units));

  return {
    resourceType: "Bundle",
    type: "searchset",
    total: resources.length,
    timestamp: new Date().toISOString(),
    entry: resources.map((resource) => ({
      resource: JSON.parse(JSON.stringify(resource)),
    })),
  };
}
