# "You" profile and linked symptom inputs (design, 2026-11-15)

## Why
Ben: "link it, make it empty, measure me ... and we check if it's actually valid". Three rules say inputs are "not logged yet" although Daily Log already collects some of them, and every profile is simulated. Ben wants to be measured himself.

## Decisions (Ben, 2026-11-15)
- A fourth profile "You" (id `U1`) with no simulated values; real data only: Apple Health import (weeks of heart rate, sleep, oxygen, weight, temperature build the personal normal), the strap, Daily Log check-ins, tests and symptoms. Signals nobody measures stay Unknown.
- Logged symptoms, the vision self-report and a new 1-5 workload check-in count in the rules (demo weights, not validated; Leo to be told).

## Design
- Engine (`src/engine/risks.ts`, `src/rules/*`, `src/engine/assessment.ts`): logged inputs become extra drift entries before scoring: a ticked symptom = 3.0; vision clarity 2 = 3.0, 1 = 4.0; workload 4 = 2.5, 5 = 3.5. Rules list them as weighted signals: fluid shift (headache, puffy face, blurred vision, low vision clarity), immune strain (cold sore, skin problem), cognitive readiness (high workload). "Missing inputs" is only reported while an input is not logged. Persistence and missing-signal checks ignore these keys.
- Workload: new value `workload_1to5` ("score/5") in the check-in (backend `UNITS`), a 1-5 scale in Daily Log.
- "You": `src/data/you.ts` adds `U1` with 120 empty days to any dataset (app and server, also after a scenario run); server accepts `U1`; Medicines shows an honest empty state for `U1`; Overview says what is and is not measured when most signals are missing.
- Validity is checked with real inputs, not claimed: one person's data is a sanity check, not validation.

## Checks
Tests: symptoms raise fluid shift and immune strain, high workload adds to cognitive readiness, nothing changes without inputs (all engine checks keep passing); `U1` has 120 empty days, accepts measurements and check-ins on the server, and a 60-day import gives a personal normal.
