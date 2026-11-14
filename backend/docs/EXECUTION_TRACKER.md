# Execution tracker — working demonstration

This tracker distinguishes software acceptance from clinical validation. All items
below are implemented for the fictional local prototype. No medical effectiveness,
flight clearance, medication potency accuracy or actual Earth transmission is claimed.

## P0 — 7/7 prototype tasks

- [x] Sync and isolate: `manar-backend` starts from Leo's `9cde66c` main commit in Manar's fork.
- [x] API server: Fastify, health, Zod contracts, Swagger, sanitized errors, bounded bodies.
- [x] Dataset: 3 crew ×120 days, full coverage/uniqueness checks, source hash, selectors.
- [x] Baseline/drift: reused TypeScript with time-leakage, missing-input and spacing fixes.
- [x] Coupled engine: seven shared rules, required signals, persistence and Unknown output.
- [x] Replace alerts: Overview uses API/shared-engine results and contributing measurements.
- [x] Reproducible demo: day50/day60 renal change, day40 radiation, day70 cognition.

## P1 — 6/6 prototype tasks

- [x] Assistant: deterministic/offline response, source references and optional constrained AI selection.
- [x] Triage: shared conservative symptom screen precedes AI; medication requests cannot produce doses.
- [x] Readiness: explicit Go/Caution/No-go/Insufficient data advisory with human approval requirement.
- [x] Communications: SQLite drafts, approval, idempotency, windows/delay and simulated delivery.
- [x] Provenance: dataset identity, contributing signals, rule version, evidence IDs and limitations.
- [x] Tests: triggers/non-triggers, persistence, missing values, future leakage, isolation, safety, API and browser.

## Full feature inventory — 19/19 represented in prototype

| Feature             | Working surface                                           | Limits                                                           |
| ------------------- | --------------------------------------------------------- | ---------------------------------------------------------------- |
| Vitals              | Snapshot, Health, editable Daily Log                      | Fictional data; no instrument integration                        |
| Ionizing radiation  | Shared rule, Mission, NASA cache/refresh                  | Historical instrument quantity distinct from crew dose           |
| Bone health         | Shared trends and coupling                                | Simulated density/index, not measured bone loss                  |
| Muscle/exercise     | Trends, logs, musculoskeletal rule                        | No prescribed individualized exercise plan                       |
| Sleep/circadian     | Check-in, debt input, cognition/readiness                 | Demo debt and schedule context, no diagnostic sleep model        |
| Mental health       | Mood/stress/symptoms, assistant escalation                | No psychiatric diagnosis or live psychologist service            |
| Hydration/renal     | Four-signal persistent renal pattern                      | No kidney-stone probability/diagnosis                            |
| Vision/SANS         | Vision self-report, symptoms and Unknown-aware rule       | No clinical SANS test                                            |
| Nutrition           | Calorie/body-mass/vitamin-D inputs, under-fuelling rule   | No supplement prescription or deficiency diagnosis               |
| Cognition/readiness | Recorded reaction/memory tasks and shared gate            | Educational tasks, no flight clearance                           |
| Medication          | Schedule references, expiry/storage, adherence            | No validated potency forecast; strength stays unknown            |
| AI officer          | Backend + offline assistant                               | Reviewed wording only; no open-ended diagnosis                   |
| Body map            | Engine-linked Overview flags and Health views             | No separate spatial risk calculation                             |
| Mission profiles    | Selectors, shared context, explicit delay                 | Changing profile never relabels Mars source dose                 |
| Earth link          | Approved simulated outbox with persistence                | Nothing actually transmitted                                     |
| Offline             | PWA app cache, bundled data/evidence, local history/rules | Hosted model/NASA refresh need network                           |
| Immune strain       | Additional symptom checks + demo pattern                  | Without symptoms remains Unknown; no immune diagnosis            |
| Crew overview       | Mission panel + crew overview API                         | Demo ordering, not validated medical triage                      |
| What-if             | Isolated projected days and re-evaluation                 | Held values plus chosen edits, not a digital physiology forecast |

Acceptance evidence is recorded in `VERIFICATION.md`. Persistent unknowns and explicit
unavailable forecasts are intentional scientific boundaries, not fabricated feature results.
