# Verification record

- Engine/API/safety/persistence tests use Node's test runner through tsx.
- The 20 assistant questions cover emergency, medication, uncertainty and unsafe requests.
- Hosted-model outage/invalid-output tests use mocks; no live model credential was used.
- Browser checks use Chromium: changing dashboard scenarios, day-one missing baseline,
  urgent assistant response, explicit report approval, mobile Daily Log and Evidence.
- Existing upstream drift/risk checks remain part of verification.
- Production build generates a service worker with app/evidence/data assets. A separate
  preview/offline reload check verifies its actual behavior.

These checks establish software behavior on synthetic cases. They do not establish
medical sensitivity/specificity, prospective prediction accuracy, human-factors approval,
scientific novelty or fitness for a real mission. Mechanism evidence is not algorithm validation.

## Completed run

- 55 Node engine/API/safety/persistence/provider tests pass.
- Four Chromium browser checks pass, including an actual production offline reload.
- Frontend and backend TypeScript checks pass; the production/PWA build succeeds.
- Upstream drift and risk checks pass.
- A live historical RadLab query returned DosTel1 5.26644315384615 microgray/hour at
  2022-04-01T23:05:00Z. The proxy-equipped test host used NODE_USE_ENV_PROXY=1.
- The optional hosted model was not called live; its success, timeout/error and
  malformed-output behavior was tested with controlled responses.
