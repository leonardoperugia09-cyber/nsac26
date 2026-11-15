# Scenario editor and Claude assistant (design, 2026-11-15)

## Why
Ben: HALO must "work for real", not only replay one fixed demo file. Users should be able to change the crew data and run simulations, and the assistant should give real, personal answers. Submission closes tonight (15 Nov 23:59), so scope is what can be built and checked today.

## Goals
- Edit each astronaut's name, role, age and the simulator's 12 normal values; edit an event list (who, type, day, length, strength); pick "today"; run the simulation; reset to the original data.
- Works in the browser (Cloudflare demo has no server). When the HALO server runs, it uses the same edited data, so the assistant and FHIR export match the screen.
- Assistant: Claude (Anthropic) as a third hosted provider; four quality fixes; AI statement names Claude.

## Non-goals (today)
- Adding or removing astronauts (slots C1-C3 stay: medicines, mission and assistant data are keyed to them).
- Importing a whole custom dataset file (instrument CSV/Apple Health import already covers real readings).
- Hosting the Node server publicly (the Cloudflare demo keeps offline answers).

## Anti-goals
- Claims of clinical validity. Events and baselines are labelled as simulation.
- Breaking the existing story: running the default event list must reproduce today's story (close, not bit-identical numbers).

## Approaches (decided)
1. Picked: TypeScript port of `scripts/crew_simulator.py` with a seeded random generator and a configurable event list; result stored on the device; existing overlays (check-ins, tests, instrument readings) stay on top.
2. Rejected: server-only simulation (no server on the static demo). Rejected: free-form dataset editing (too broad for today, breaks per-astronaut data).
- Assistant: add an Anthropic provider module next to OpenAI/Azure (Ben's Azure sign-up failed on a prepaid card). Model chosen by Ben: `claude-opus-5-5`.

## Design
- `src/sim/simulator.ts`: `simulate(crew, events, days=120, seed=42)` returns SimData. Event types: `solar_storm` (all or one, start day, length, extra mSv), `fluid_drop` (one astronaut, from day, % less, plus saltier food and fewer workouts as today), `short_night` (one astronaut, day, hours; marks a spacewalk that day).
- `src/data/crew.ts`: SIM becomes a store: custom dataset from localStorage (`halo-sim-custom-v1`) else the bundled JSON; a change fires `halo-data-change` so views recompute. `DEMO_DAY` becomes the stored "today".
- Settings: "Scenario" card replaces "Demo scenarios" (sketch agreed in chat): astronauts with "Edit baseline", events list with add/remove, day picker, Run simulation (primary), Reset to original.
- Server: `POST /api/dataset` (replace in-memory dataset, persisted in SQLite, same validation: 3 crew, days 1-120) and `DELETE /api/dataset` (back to the bundled file); the app sends the edited dataset after each run and on reset.
- Per-astronaut copy that only fits the original story (the C2 "earlier today" seed chat) shows only with the original data.
- Assistant (`backend/node`): provider `anthropic` (`AI_PROVIDER=anthropic`, `ANTHROPIC_API_KEY`, optional `HALO_MODEL`, default `claude-opus-5-5`) using the official SDK with structured output; refusal or any failure falls back to the offline answer; server-side refusal fallback enabled. Fixes: no fluid prescription; headache asks red-flag questions; dizziness topic; radiation dose, sleep and urine answers use the astronaut's own data, also offline.

## Left to the builder
Exact form controls and validation ranges for baselines, event strength defaults, error copy.
