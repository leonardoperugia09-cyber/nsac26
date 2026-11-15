# Submission pack

Text for the NASA Space Apps project page (Challenge: "Create Health Monitoring Software for Astronauts on Space Missions").
Adapted from Gurman's `docs/SUBMISSION.md` on the `gurman-backend` branch; the AI statement, sources and demo script
were updated to match what is built.

## One-line pitch
When the doctor is 20 minutes away, HALO is the medical officer that is already there. It links signals across body
systems, spots a risk before it becomes an emergency, and tells the crew what to do next.

## Where to look
- **Live demo:** https://halo.nubidubi0977.workers.dev. It opens on mission day 58 with Marco, whose kidney stone risk is high.
- **To see Claude:** open Assistant and tick "Use hosted AI for this session" (it is off by default because the question and
  readings then leave the device). Without it the assistant answers from the bundled sources and says so.
- **Code:** this repository. `npm ci`, `npm run dev:full`, `npm test`, `npm run check`.
- **Limits, stated plainly:** all crew data is simulated; the thresholds are demonstration parameters; the 46 source
  summaries have not been reviewed by a physician or space-medicine expert; the layout is for laptops and tablets, not phones.

## Use of Super Intelligence (SI): what to enter on the form
Yes. See "AI use statement" in the README for the full text. In short:
- The risk engine, emergency detection and crew simulator are deterministic code, not AI.
- The assistant can use Claude Opus 5.5 (Anthropic) to word an answer from the source summaries; emergency rules run first,
  and HALO rejects answers that cite an unknown source, give a dose, or give a diagnosis.
- Claude Code (Claude Opus 5.5 and Sonnet 5.5) and OpenAI Codex helped write the code, tests, documentation and evidence
  summaries. The team reviewed and tested the output.
- No AI-generated images; no NASA logos or branding.
- Tests of the assistant on fresh sets of 100 questions: 93 passed on one set and 87 on another (our bar was 90). A second
  Claude model acted as fact-checker, so this is not medical validation.

## NASA data and resources used
- NASA Technical Reports Server evidence reports from the Human Research Program, used as the assistant's source library.
  Examples: Risk of Renal Stone Formation; Risk of Spaceflight Associated Neuro-ocular Syndrome; Risk of Crew Adverse Health
  Event Due to Altered Immune Response; Risk of Ineffective or Toxic Medications; Risk of Acute Radiation Syndromes Due to
  Solar Particle Events. 39 full texts are searched (NASA public-use and open-access licences); the Evidence page lists all 46 sources.
- NASA OSDR RadLab (ISS dose rate): the server can fetch it and ships one cached 2022 snapshot (`backend/resources/radiation.json`).
  The radiation numbers on screen are simulated.
- NASA Human Body in Space overview; Mars cruise dose rate from NASA's MSL RAD instrument (about 1.8 mSv per day, published).

## Other tools and references
React, Vite, TypeScript, Fastify, SQLite, Cloudflare Workers, the Anthropic API; Geist fonts (SIL OFL) and Phosphor icons (MIT).
All sources and credits are on the Evidence page and in the README citations.

## 30-second demo script (matches the app; mission day 58, Marco)
1. 0:00 to 0:05. Say your name and team, and the challenge: "Astronauts must spot health changes in themselves."
2. 0:05 to 0:10. Name the project and tagline. Show Overview: "Kidney stone risk is high": fluid, urine and sodium drifting together.
3. 0:10 to 0:16. Tap "I drank 250 ml": the plan is a short checklist. Open Health: the kidneys and skeleton are flagged on the body map.
4. 0:16 to 0:25. Open Assistant, tick "Use hosted AI", ask "Why is my kidney stone risk high?". The dots, then an answer labelled
   "Your data" and "What the research says", with NASA sources named.
5. 0:25 to 0:30. Type "I vomited blood": the emergency response fires at once, with no AI. Close on: built on NASA's own reports; simulated crew, not a medical device.

For slides instead of a video (7 at most): title and team; the problem; how HALO works (personal baseline, coupled risks); Overview screenshot;
Assistant screenshot with sources; NASA data and tests; limits and what comes next.

## Final checks before submitting
Opens Sat 14 Nov 09:00 and closes Sun 15 Nov 23:59 in the Local Event's time zone (or the Team Owner's, for the Universal Event).
- [ ] Demo is 30 seconds or less (or at most 7 slides), the link is public, in English, and opens in a private window
- [ ] No recognisable faces or names of anyone under 18; no NASA logos in the demo
- [ ] The final project link opens without login; the repository is public with no `.env` committed
- [ ] The team and project name are the same on the page, in the demo and in the repository
- [ ] The AI statement is pasted into the form and the team has checked the sentence about who had the idea
- [ ] "Submit for Judging" is pressed, with the Terms and "work is original" boxes ticked, and the banner has appeared
