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
