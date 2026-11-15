# HALO — Health Autonomy for Long Operations

An integrated NASA Space Apps research demonstration: explainable coupled health
patterns, a React interface, and a Node.js/Fastify backend sharing one TypeScript
baseline and risk engine. **Fictional crew data. Not a medical device.**

## Run the complete prototype

Node 22.13 or newer (tested on Node 24):

## What makes HALO different
1. **Coupled Risk Engine** — links systems (e.g. bone loss + low fluid + kidney remodelling → kidney stone risk)
2. **Delay-aware AI medical officer** — offline-first, grounded in NASA evidence, never gives drug doses
3. **Personal baseline drift** — compares each astronaut to their own normal, learned from early-flight days 7 to 20
4. **Mission readiness gate** — go / caution / no-go before high-risk tasks like EVAs
5. **Pharmacy potency tracker** — forecasts which onboard medicines are losing strength

## Repo layout
```
data/        simulated crew data (crew_sim.json / .csv)
scripts/     crew simulator (3 crew x 120 days, planted demo events) and the engine checks
src/engine/  personal baselines + drift scores, coupled risk engine, medicine potency tracker
src/rules/   coupling rules, one file per rule, each with its citation
src/         the app (React + Vite)
backend/     server: assistant (offline rules, optional Claude/OpenAI/Azure), NASA evidence library and full texts, storage, RadLab cache
```

## Getting started
```bash
npm ci
npm run dev:full     # app on http://localhost:5173 and the HALO server on :3001 (API docs at /docs)
npm run dev          # app only (the assistant then answers from on-board rules)
npm run check        # engine checks: drift, risks, body map, potency, simulator
npm test             # server, assistant, evidence and safety tests
npm run eval:safety  # the 30 safety prompts against the hosted AI (needs the key in .env; costs cents)
python3 scripts/crew_simulator.py   # regenerates data/ exactly (seed 42)
```
Change the crew, their normal values and the events in Settings > Scenario; every screen recomputes from the simulation.

**Demo path (day 58, Marco):** Overview opens with the daily check-in, then the kidney stone Act and its plan. Health shows the body map (kidneys and skeleton Act). Mission shows spacewalk readiness and the day-40 solar storm. Medicines shows today's doses and the onboard kit's potency forecast. Assistant answers symptoms and refuses doses.

## Included

- All seven coupled patterns, with missing-input gates, persistence, source references,
  uncertainty and explicit Unknown outcomes.
- Local check-ins, educational cognition/vision tasks, source-labelled trends and body map.
- Triage-first assistant with offline fallback and optional evidence-grounded conversational AI (server configuration required).
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
| Medication potency                               | Forecast from published ISS data plus our assumptions; not validated  |
| Report delivery                                  | Simulated only; nothing is transmitted to Earth or other people       |

Hosted AI needs network access and a key; local monitoring and bundled reference summaries
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

Hosted assistant setup, live verification and deployment: [backend/docs/ASSISTANT.md](backend/docs/ASSISTANT.md).

Azure OpenAI and the credit-offer setup: [backend/docs/AZURE.md](backend/docs/AZURE.md).

Put API keys in a `.env` file (copy `.env.example`). **Never commit `.env`.**

## Team workflow
Make a branch before you code (`git checkout -b yourname-feature`) and merge into `main` with a Pull Request.

## Medicine potency tracker
There is no pharmacy resupply on a Mars transit, so HALO forecasts how strong each onboard medicine still is and when it will drop below 90% of its label strength (the usual US Pharmacopeia limit).

- **Code:** `src/engine/potency.ts` (`forecastPotency`), shown in the Medicines tab under "Your onboard kit".
- **Inputs:** days since the pack was made, the radiation it has absorbed in flight so far (from the crew data, including the day-40 solar storm), and the expected dose per day from here on for the mission profile.
- **Model:** first-order breakdown. On Earth a pack is assumed to reach 90% on its label date. Spaceflight adds extra ageing in proportion to the radiation dose, calibrated so the ISS comes out about 1.5 times faster than Earth.
- **Range, not a single number:** the band runs from no extra effect in flight (Wotring 2016) to twice as fast. Every medicine shows today's strength with that range, and the day it drops below 90% at best, best estimate and worst.
- **Check:** `node --experimental-strip-types scripts/check_potency.ts` tests the calibration, the shape of the curve, ISS vs Mars, and that the day-40 solar storm moves the forecast.

| Evidence | What it shows | How HALO uses it |
|---|---|---|
| Du et al. 2011, *AAPS J* 13:299 | 35 formulations, identical kits on the ISS and on Earth. After 28 months, 9 from the ISS and 17 from the ground met the US potency standard. | Spaceflight makes medicines break down faster |
| NASA ExMC reanalysis of Du et al. (Reichard, NTRS 20220000500) | First-order breakdown; spaceflight about 1.5 times faster | Best-estimate rate on the ISS |
| Wotring 2016, *AAPS J* 18:210 | 9 medicines returned after 550 days on the ISS; no unusual breakdown products; 5 still passed 5-8 months after their label date | Optimistic edge of the range; label date treated as a cautious 90% point |
| Blue et al. 2019, *npj Microgravity* 5:15 | The effect of space radiation on medicines cannot yet be predicted reliably | Why HALO shows a range and labels the dose scaling as our assumption |

> Scaling the ISS result by radiation dose for deep space is **our assumption**: nobody has measured it. Shelf lives are typical label values and the pack age at launch (180 days) is a demo value. This is a planning aid, not a lab test.

## Real vs simulated data
| Data | Real or simulated | Source |
|---|---|---|
| 3 crew members, their pre-flight baselines and 120 days of daily readings | **Simulated** | `scripts/crew_simulator.py` (seed 42) → `data/crew_sim.json`. Baselines are chosen by us to be realistic. |
| Rates that drive the simulated readings (bone, calf muscle, plasma volume, blood pressure, body temperature, body mass, sleep, energy intake) | **Real published rates** | NASA and papers named in the simulator and in `docs/realistic-vitals.md` (Norsk 2015, Stahn 2017, Barger 2014, Trappe, Smith) |
| Mars cruise radiation, 1.8 mSv/day with day-to-day spread | **Real published rate**, applied to simulated days | MSL RAD (Zeitlin 2013, Guo 2015) |
| Day-40 solar storm (about 18 mSv over 2 days) | **Simulated** | Sized inside what MSL RAD measured per event (1.2-19.5 mSv) |
| ISS normal dose (0.55 mSv/day) | **Real order of magnitude** | Published ISS missions average about 72 mSv per 6 months (Cucinotta 2008), about 0.4 mSv/day; we round up to a cautious 0.55 |
| Moon normal dose (1.4 mSv/day) | **Demo estimate** | Our own; no live feed yet |
| Live RadLab radiation feed | **Not connected yet** | NASA OSDR RadLab API; the cached `data/radlab_snapshot.json` is not in the repo yet |
| Personal baseline bands and drift scores | **Our method** on simulated data | `src/engine/baseline.ts`; thresholds are demo values |
| Coupled risk rules | **Published links, demo thresholds** | Physiology and citations in `src/rules/`; weights and Watch/Act levels are ours |
| Medicine potency findings | **Real published studies** | Du 2011, Wotring 2016, NASA reanalysis, Blue 2019 (see above) |
| Medicine potency forecast for deep space | **Our extrapolation** | Dose scaling, shelf lives and pack age are our assumptions |
| Medicine schedules, kit stock and dose history | **Simulated** | `src/ui/medicinesData.ts` |
| Vitamin D decline, bone-breakdown index, sleep-debt and reaction-time weights | **Demo parameters** | Marked `DEMO` in the simulator |

## Challenge requirements
- [ ] Gathers health indicators and lets astronauts act on them
- [ ] Visual self-assessment tool (clickable body map)
- [ ] Guidance on treatments / health improvements
- [ ] Six named indicators: blood pressure, heart rate, blood sugar, temperature, sleep, mood
- [ ] Which measurements work in space, and why each matters
- [ ] How spaceflight hazards affect each indicator
- [ ] When to involve crew / flight surgeons
- [ ] Preventive actions

## AI agent test results
_20-question safety / accuracy / clarity eval — to be added._
