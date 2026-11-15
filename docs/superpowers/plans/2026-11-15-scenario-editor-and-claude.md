# Scenario editor and Claude assistant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Users edit the crew and events and re-run the simulation in the app; the assistant can answer with Claude and its four known bugs are fixed.

**Architecture:** A TypeScript port of the Python simulator runs in the browser; `src/data/crew.ts` keeps a live-bound `SIM` that a custom dataset in localStorage can replace; the Node server mirrors the edited dataset through a new endpoint. The assistant gets an Anthropic provider module beside OpenAI/Azure.

**Tech Stack:** React 18 + TypeScript + Vite, Node/Fastify + zod + node:sqlite, `@anthropic-ai/sdk`, tests with `tsx --test` and `tsx scripts/check_*.ts`.

**Spec:** `docs/superpowers/specs/2026-11-15-scenario-editor-and-claude-design.md`

## Global Constraints
- Crew slots stay C1, C2, C3; days 1-120; dataset `meta.simulated` stays `true` (server validation in `backend/node/data.ts`).
- localStorage key for the custom dataset: `halo-sim-custom-v1`; any change dispatches `halo-data-change`.
- Model id `claude-opus-5-5`; env `AI_PROVIDER=anthropic`, `ANTHROPIC_API_KEY`, optional `HALO_MODEL`.
- UI copy: sentence case, no em or en dashes, honest labels ("simulated").
- No commit or push without Ben's OK.

## Review Focus
- Running with the default event list must still give Marco a kidney stone risk at Act on day 58 (the demo story).
- "Today" below day 21: pages must show "not enough data yet" states, not crash.
- A baseline value typed as empty or out of range must be rejected in the form, not saved.
- Reset must also reset the server's copy when the server runs.
- Hosted AI failure, timeout or refusal must fall back to the offline answer with its label.

---

### Task 1 (helper): Claude provider
**Files:** Create `backend/node/assistant-anthropic.ts`; Modify `backend/node/model-config.ts`, `backend/node/assistant-model.ts` (dispatch only), `backend/node/assistant.ts` (`assistantStatus` provider), `src/shared/assistantTypes.ts` (provider union adds `"anthropic"`), `src/pages/Assistant.tsx` (provider name in the consent note), `.env.example`, `backend/.env.example`, `backend/docs/ASSISTANT.md`, `src/ui/referencesData.ts` (AI statement names Claude by Anthropic), `package.json` (dependency `@anthropic-ai/sdk`). Test: `backend/tests/assistant.test.ts`.
**Interfaces:** Produces `generateAnthropicAnswer(input, options): Promise<GeneratedAnswer>` with the same return shape `generateAnswer` has today.
- [ ] Tests: config resolves `anthropic` with key + default model `claude-opus-5-5`; missing key gives `not_configured`; a mocked refusal or error becomes `failed_using_offline_fallback`.
- [ ] Implement with the official SDK, structured output via `output_config.format` (same JSON schema as today), `thinking: { type: "adaptive" }`, explicit effort, server-side refusal fallback beta, timeout 30 s for this provider. Run `npm test` and `npm run typecheck:backend`: all pass.

### Task 2 (helper): Four assistant fixes
**Files:** `src/shared/assistantTopics.ts`, `src/shared/offlineAssistant.ts`, `backend/node/assistant.ts`, `backend/tests/assistant.test.ts`.
**Interfaces:** `topicAnswer(question, priority, facts?: { reading?: Record<string, unknown>; drift?: Record<string, { value: number; bandLo: number; bandHi: number; status: string }> })`.
- [ ] Tests: "what should I do" never contains a volume like "500 ml"; "I have a headache" asks about sudden severe onset and vision change instead of asserting "no red flags"; "I feel dizzy when I stand up" gets its own answer; "What is my radiation dose so far?" contains the astronaut's `radiation_mSv_total`; sleep and dark urine answers quote the astronaut's own values.
- [ ] Implement; both server and offline paths pass `facts`. `npm test` passes.

### Task 3: Simulator port
**Files:** Create `src/sim/simulator.ts`, `scripts/check_sim.ts`; Modify `package.json` (`"check:sim": "tsx scripts/check_sim.ts"`).
**Interfaces:** Produces `type SimEvent = { id: string; type: "solar_storm" | "fluid_drop" | "short_night"; crewId: string | "all"; day: number; length?: number; strength: number }`, `DEFAULT_EVENTS: SimEvent[]`, `simulate(crew: CrewMember[], events: SimEvent[], seed?: number): SimData` (120 days, `meta.simulated: true`).
- [ ] Checks: 360 rows; the C2 fluid drop day has `fluid_intake_drop` event; day 40 has `solar_storm`; C3 day 70 sleep 3.4 and `eva_scheduled`; `assessCrew` for C2 day 58 returns `kidney_stone` at Act; with the events list empty, no `kidney_stone` Act for C2 on day 58.
- [ ] Port `scripts/crew_simulator.py` line by line with a seeded PRNG (mulberry32 + Box-Muller); events replace the hardcoded planted constants. `npm run check:sim` prints ALL CHECKS PASSED.

### Task 4: Live dataset store
**Files:** Modify `src/data/crew.ts`.
**Interfaces:** Produces `export let SIM: SimData`, `export let DEMO_DAY: number`, `saveScenario(data: SimData, today: number): void`, `resetScenario(): void`, `isCustomScenario(): boolean`, `scenarioOf(): { crew: CrewMember[]; events: SimEvent[]; today: number }`.
- [ ] Custom data is read from `halo-sim-custom-v1` at load (fallback to the bundled JSON on any parse error); save and reset dispatch `halo-data-change`. `npm run typecheck` and existing checks pass.

### Task 5: Scenario card
**Files:** Create `src/components/ScenarioCard.tsx` + `.module.css`; Modify `src/pages/Settings.tsx` (replace the Demo scenarios card), `src/App.tsx` (initial day from `DEMO_DAY`; after a run set day), `src/pages/Assistant.tsx` (C2 seed chat only when `!isCustomScenario()`).
- [ ] Verify in the browser: edit Marco's fluid normal and remove the fluid drop, run, Overview no longer shows the kidney stone risk; reset brings it back; today below 21 shows a not-enough-data state.

### Task 6: Server mirror
**Files:** Modify `backend/node/data.ts` (export the validator), `backend/node/app.ts` (`POST /api/dataset`, `DELETE /api/dataset`), `backend/node/responses.ts`; client call in `src/data/crew.ts`. Test: `backend/tests/api.test.ts`.
- [ ] Tests: POST a valid edited dataset changes `/api/snapshot`; invalid (2 crew) gives 422; DELETE restores the bundled data. `npm test` passes.

### Task 7: Final check
- [ ] `npm run typecheck`, `npm run typecheck:backend`, `npm test`, all `check:*`, `npm run build`, browser walk-through of Overview, Health, Assistant, Settings. Show Ben; no commit before his OK.
