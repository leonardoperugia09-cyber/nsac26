# HALO backend and integrated prototype

Node.js + Fastify, sharing the team's TypeScript baseline and rule engine with React.
This is a working **research demonstration, not a medical device**. All crew data are
fictional. Demonstration risk levels and Go/Caution/No-go are not clinical validation
or permission to perform an EVA.

## Run

Use Node **22.13+** (tested with Node 24). From the repository root:

```bash
npm ci
npm run dev:full
```

Frontend: http://localhost:5173. API and interactive JSON contracts:
http://127.0.0.1:3001/docs. `GET /openapi.json` exports the API specification.
`npm run server` and `npm run dev` also run separately. The SQLite database is created
under `backend/var/`, ignored by Git. No external credential is needed for the demo.

Configuration comes from exported environment variables in `backend/.env.example`;
`.env` is not automatically loaded. Node24 environments with an HTTPS proxy may need
`NODE_USE_ENV_PROXY=1` when starting the service. Non-loopback binding requires a service token.
When configured, enter that token in browser Settings. This local prototype does not
provide per-user authorization or isolation between real patients. Only fictional
crew records should be used. Shared production hosting requires a reviewed identity,
TLS, authorization, retention and operational deployment design.

## Reproduce the central story

```bash
npm run demo
```

- C2 day 50: no persistent renal pattern.
- C2 day 60: kidney-stone-related **Act** pattern, with contributing measurements.
- C1 day 40: radiation **Act** and readiness No-go.
- C3 day 70: acute multi-signal cognitive **Act** before scheduled EVA; No-go advisory.

The Overview has buttons for these scenarios and selectors for day/mission/astronaut.
Severity is calculated, not fixed mock text. Some hypotheses remain **Unknown** until
additional symptom/vision inputs are supplied. Selecting ISS does not relabel the
Mars simulator's radiation as measured ISS exposure.

## What works

- Bounded, source-validated 3-crew ×120-day dataset, SHA256 provenance and crew selection.
- Shared TypeScript baseline/drift and seven demonstration coupling rules.
- Required-signal checks, Unknown outcomes, persistent multi-signal changes, and immediate
  acute radiation / scheduled-EVA cognition logic.
- Overview risk severity, contributing measurements, generated review tasks and body-map flags.
- Saved daily check-ins, additional vital/exercise/nutrition inputs, symptom checks and local fallback.
- Reaction/memory educational tasks and vision self-report; recorded results, not clinical tests.
- Deterministic assistant/triage, offline fallback and optional constrained hosted-AI wording selection.
- Transparent mission readiness, crew overview and isolated what-if exploration.
- Durable report drafts, explicit approval, idempotent simulated outbox and delay calculations.
- Medication schedule references, expiry/storage checks and adherence history, without prescriptions.
- Source summaries, population/limitations, pending-review labels and exportable evidence bundle.
- Real historical RadLab snapshot plus a bounded on-demand NASA refresh adapter preserving original units.
- PWA app-shell caching, bundled dataset/evidence and on-device calculations. APIs are not cached.
- Sanitized JSON errors, request IDs, body limits, rate limits, CORS allowlist and metadata-only audit log.

## Main API contracts

All product routes use `/api`. Unless indicated, selection uses query fields
`crewId=C2&day=60&profile=mars_transit`. Profiles: `iss`, `moon`, `mars_transit`.

| Method   | Path                                                     | Purpose                                                         |
| -------- | -------------------------------------------------------- | --------------------------------------------------------------- |
| GET      | `/health`                                                | Process liveness, not external-service readiness                |
| GET      | `/api/crew`, `/api/signals`, `/api/missions`             | Dataset and field/unit contracts                                |
| GET      | `/api/snapshot`, `/api/history`, `/api/risks`            | Context and source-linked shared-engine output                  |
| POST/GET | `/api/checkins`                                          | Upsert/list fictional crew logs                                 |
| POST     | `/api/measurements/review`                               | Unit/provenance/time-quality review, not medical interpretation |
| GET      | `/api/readiness`, `/api/crew-overview`                   | Demo readiness and crew ordering                                |
| POST     | `/api/assistant`                                         | Triage first, explanation second; no automatic report sending   |
| GET      | `/api/evidence`, `/api/protocols`, `/api/offline-bundle` | Evidence and educational review cards                           |
| POST     | `/api/reports/draft`, `/api/reports/queue`               | Draft and explicitly approved simulated queue                   |
| GET      | `/api/reports`, `/api/outbox`                            | Crew-isolated report history and simulated delivery state       |
| POST/GET | `/api/medications`                                       | Human-entered demo schedule references                          |
| POST     | `/api/adherence`                                         | Taken/missed/not-recorded observations                          |
| POST/GET | `/api/tests`                                             | Educational reaction, memory and vision records                 |
| POST     | `/api/what-if`                                           | Isolated held-value scenario, never written into source history |
| GET/POST | `/api/radiation`, `/api/radiation/refresh`               | Cached original quantity and bounded NASA fetch                 |
| GET      | `/api/audit`                                             | Last metadata-only request records; no bodies or tokens         |

Request schemas and examples of their field names are in `/docs`. Engine result
contracts are in `src/engine/assessment.ts` and `src/rules/types.ts`. Unknown inputs
are not converted into a zero-risk score. Demo `score` is not a probability and no
fabricated confidence interval is emitted (`range` is null).

## Scientific and implementation limits

- Reference bands use days 7–20 of **simulated in-flight adaptation**, at least seven
  observations, never future data. They are distinct from the fictional pre-flight
  references and are not clinical normal ranges.
- A two-day pattern requires multiple raw contributors on both days, so one spurious
  sample cannot satisfy persistence through smoothing alone. Thresholds are demo
  parameters. Acute radiation and multi-signal pre-EVA cognition have explicit one-day exceptions.
- Evidence supports mechanisms; it does not validate HALO weights, probabilities or
  outcomes. Source content remains pending expert review. No action card is flight-approved.
- RadLab DosTel1 data use **µGy/hour absorbed dose rate**, separate from the simulator's
  **mSv/day**. The historical sample is stale by design and never called live telemetry.
  No Gy-to-Sv conversion or assignment of instrument exposure to a person is inferred.
- Medication strength is **unknown**. Product-specific potency forecasting is unavailable;
  invented general degradation coefficients and use-first recommendations were removed from the active UI.
- Optional AI needs `AI_API_KEY`, `HALO_MODEL`, and explicit user opt-in. It generates an
  ordering of reviewed explanation sentences; arbitrary generated clinical prose is not
  shown. Unavailable/invalid output falls back to deterministic wording. No live hosted
  model call was made during verification; success/failure paths are mocked.
- A report's delivered state always says **simulated**. No email, Slack or real medical
  transport is implemented or contacted. Earliest reply time assumes immediate response.
- Browser offline persistence uses localStorage, not an encrypted medical record. Server
  SQLite stores only demonstration records; a service token is not per-patient access control.

## Checks

```bash
npm test
npm run check:drift
npm run check:risks
npm run typecheck
npm run typecheck:backend
npm run build
npm run test:browser
```

Browser tests use system Chromium by default. Set `HALO_CHROMIUM_PATH` if installed
elsewhere. Production service-worker behavior must be tested against `npm run preview`,
not the Vite development server. See `docs/EXECUTION_TRACKER.md` for task coverage.

## Layout

`backend/node/`: contracts, Fastify app, validated data source, SQLite store, evidence,
assistant and NASA adapter. `src/engine/`: shared computation; `src/shared/`: shared
triage and browser integration. `backend/resources/`: evidence and historical NASA
snapshot. `backend/tests/`: engine/API/safety/persistence/browser tests.

Earlier Python work is preserved separately in the workspace/previous branch. This
branch has one server implementation so scoring stays in the existing TypeScript engine.
