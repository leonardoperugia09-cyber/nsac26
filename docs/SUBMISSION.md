# Submission pack

## One line pitch
When the doctor is 20 minutes away, HALO is the medical officer that is already there. It links signals across body systems, spots a risk before it becomes an emergency, and tells the crew what to do next, offline.

## AI use statement (Space Apps requires this)
- The in-app assistant calls a hosted language model (Claude, via the Anthropic API) only to explain the crew member's own data in plain language. Emergency detection is plain rules that run first and never depend on the model. A filter removes any sentence containing a medication amount. With no key the app uses rule-based answers.
- Generative AI tools were used to help write code, documentation and the evidence summaries. The team reviewed the output and is responsible for it.
- Crew data is simulated. No real patient data was used.

## Data and sources
- NASA OSDR RadLab Data API (ISS DosTel radiation), cached snapshot.
- NASA Human Research Program, NTRS reports and the papers cited in `src/rules/` and `backend/src/halo_backend/resources/evidence.json`.
- Simulated crew readings from `scripts/crew_simulator.py`. Mars dose rate from MSL RAD (about 1.8 mSv per day).
- Fonts Geist (SIL OFL), icons Phosphor (MIT).

## Demo script (90 seconds, then cut to 30 seconds for the video)
1. Overview, day 58. Show the body map and the quiet Nominal state. (10 s)
2. Move to day 60. Kidney stone risk goes to Act. Say "three signals drifting together, none alarming alone." (20 s)
3. Click the kidney on the body map. Show the evidence and the personal baseline band. (15 s)
4. Open the Assistant, tap "What should I do". Show evidence used, the escalation line and the report for Houston. (20 s)
5. Type "I can't breathe". Show the red flag response firing instantly, with no model. (10 s)
6. Mission page, day 70. EVA readiness shows No-Go from short sleep and slow reaction. (15 s)

## Final checks before submitting (opens Sat 14 Nov 09:00, closes Sun 15 Nov 23:59 local)
- [ ] Video 30 s or 7 slides, link is public, English
- [ ] No recognisable faces or names of anyone under 18
- [ ] Repo public, no `.env` committed, `npm run build` passes
- [ ] README test results updated after a run with a real key
- [ ] Team names and roles correct on the project page
- [ ] AI use statement pasted into the submission form
