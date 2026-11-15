# Integration review — 14 November 2026

Historical review of commit `97f9d3f`. The sentence-ordering AI experiment described
below was subsequently replaced by the conversational assistant documented in
[backend/docs/ASSISTANT.md](../backend/docs/ASSISTANT.md).

Team main integrated: `412a768a0a145a71a3a331c34ddbc2b93dc6cbd5`.

The branch retains the team's current navigation, page styling, medicine layout and anatomical map. Shared assessments replace mock alert text. Daily logs save through the API with a local fallback. Additional measurements, educational tasks, reviewed evidence registry and report/what-if/NASA tools are expandable panels in those pages.

## Engine check failures

The five previously unexplained Act results were cognitive patterns on C1 days 27, 32, 57 and 98, and C3 day 71. The simulator starts adding reaction/memory penalties below **5.5 hours**, while the old check recognized only same-day sleep at or below **5.0 hours**. The revised attribution check considers the simulator's actual threshold and the preceding day's continuing effect. It changes the test oracle, not the engine or demonstration thresholds. It does not establish clinical sensitivity or specificity.

C1 day 30 has a memory score of 77 against a lower reference limit of approximately 77.286. The anatomical map legitimately reports Watch from this direct drift even without an active coupled rule. The check now asserts that result and its memory contributor. A separate controlled reference-following fixture verifies a nominal map. Missing eyes/vision input remains Unknown.

## Behavior corrections

- Completing plan tasks never downgrades physiological severity.
- Active Act patterns block a Go demonstration recommendation. Unknown or Watch patterns prevent Go; missing core inputs produce Insufficient data.
- The body map and assistant use the same as-of-day assessment and symptom context as the backend.
- Medicine-day records are scoped by crew and mission day; drafts are never described as transmitted.
- Potency remains Unknown without product-specific stability data; generic exponential potency predictions are not displayed.
- Header delay labels describe a scenario, not an operating communications link.

## AI behavior

The coupled engine is deterministic. The offline assistant uses prepared explanatory text and a conservative emergency screen. With an API key, model setting and explicit user opt-in, a hosted model may return only an ordering of approved explanation sentences. Invalid output falls back to prepared wording. It cannot invent diagnoses, treatment or dosing recommendations through this path. No live hosted model call was made during verification. File contents and voice input are not processed.

## Boundaries

The input data are fictional mission simulations. Rules, triage and readiness are demonstration mechanisms, not validated clinical decision support or flight clearance. Evidence content remains pending expert review. SQLite/localStorage persistence and a service token are prototype infrastructure, not a production medical record system. The retained Python health scaffold is historical; the canonical server is Node/Fastify.
