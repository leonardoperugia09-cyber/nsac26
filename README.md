# HALO — Health Autonomy for Long Operations

An integrated NASA Space Apps research demonstration: explainable coupled health
patterns, a React interface, and a Node.js/Fastify backend sharing one TypeScript
baseline and risk engine. **Fictional crew data. Not a medical device.**

## Run the complete prototype

Node 22.13 or newer (tested on Node 24):

```bash
npm ci
npm run dev:full
```

Open http://localhost:5173. API documentation: http://127.0.0.1:3001/docs.
Use the Overview scenario buttons to compare C2 day50/day60, radiation day40, and
cognitive readiness day70. All severity changes come from the shared engine.

## Included

- All seven coupled patterns, with missing-input gates, persistence, source references,
  uncertainty and explicit Unknown outcomes.
- Local check-ins, educational cognition/vision tasks, source-labelled trends and body map.
- Triage-first assistant with offline fallback and optional constrained hosted-AI wording selection.
- Demonstration readiness, crew overview, isolated what-if scenarios and mission context.
- SQLite report drafts, human-approved simulated delivery, medication schedule references/adherence.
- Source/evidence browser, real historical NASA RadLab snapshot and original-unit refresh adapter.
- PWA app-shell cache and on-device data/rules/evidence for outages.

## Real and simulated

| Item                                             | Provenance                                                            |
| ------------------------------------------------ | --------------------------------------------------------------------- |
| Three crew ×120days and all their readings       | Simulated; never clinical training/validation data                    |
| Pre-flight reference values and adaptation bands | Fictional references / demo models                                    |
| Risk thresholds and readiness recommendations    | Explicit demonstration parameters                                     |
| NASA RadLab instrument snapshot                  | Real historical absorbed dose rate; labelled stale                    |
| Scientific sources                               | Authored summaries, population/limits recorded; expert review pending |
| Medication potency                               | Unknown; no validated model or strength estimate is presented         |
| Report delivery                                  | Simulated only; nothing is transmitted to Earth or other people       |

Hosted AI needs network access and a key; local monitoring and reviewed fallback wording
continue without it. Real operation would require validated sensors, approved medical
protocols, domain review, appropriate privacy controls and prospective validation.

## Connect instruments

HALO accepts real measurements next to the simulated crew data. Every reading keeps its source and provenance (`measured`, `self_reported`, `estimated`, `simulated`), and measured values replace the simulated value for that day and signal, so baselines, risks and the body map update automatically.

- **Bluetooth heart-rate strap (live):** Settings > Instruments > Connect. Uses Web Bluetooth (Chrome or Edge on a computer) and the standard Heart Rate service (0x180D), so any strap that broadcasts it works (for example the Polar H10, used in a NASA exercise study). While connected, the homepage heart rate is live and each minute's average is saved as today's reading. A clearly labelled simulated strap is available for demos without hardware.
- **File import:** Actiwatch or Hexoskin CSV exports (column mapping is shown and can be corrected) and Apple Health `export.xml` (iPhone: Health > profile > Export All Health Data). The newest imported day maps to the current mission day. Sample files are in `public/samples/`.
- **Apple Watch:** it cannot stream heart rate to a browser by itself; bring its data in through the Apple Health export.
- **API:** `POST /api/measurements` stores a batch `{ crewId, measurements: [{ signal, value, unit, sourceId, provenance, observedAt?, missionDay, quality }] }` (units must match `UNITS` in `backend/node/contracts.ts`); `GET /api/measurements?crewId&day&profile` lists them.
- **FHIR export:** `GET /api/fhir/Observation?crewId&day&profile` returns a FHIR R4 Bundle of Observations with LOINC codes (heart rate 8867-4, blood pressure panel 85354-9 with 8480-6 / 8462-4, SpO2 2708-6, body temperature 8310-5, body weight 29463-7) and UCUM units; other HALO signals use the local code system `urn:halo:signal`, and simulated values are tagged.

NASA flight instruments (Astroskin, Crew Active Dosimeter, Actiwatch on the ISS) do not stream to outside software; HALO connects to the same class of devices on the ground and to NASA's public RadLab radiation data.

## Development

```bash
npm test
npm run check:drift
npm run check:risks
npm run typecheck
npm run typecheck:backend
npm run build
npm run test:browser
```

[Backend setup and API](backend/README.md) ·
[Execution tracker and all19feature areas](backend/docs/EXECUTION_TRACKER.md) ·
[Scientific boundaries and architecture](backend/docs/ARCHITECTURE.md) ·
[Verification](backend/docs/VERIFICATION.md)

Work lives on `manar-backend`, synced from the team's main at `9cde66c`. Existing team
frontend assets and simulator are retained; the backend/scoring integrations are reviewable
on this branch. Branch changes should be reviewed before any merge to main.
