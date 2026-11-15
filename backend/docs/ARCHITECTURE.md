# Architecture and source boundaries

React screens -> JSON/HTTP -> Fastify validation/routing -> shared TypeScript assessment
-> SQLite demonstration records + versioned evidence + NASA snapshot.

The browser imports the same `assessment.ts`, baseline and rules for offline use.
No Python reimplementation or custom trained medical model exists on this branch.
Dataset values remain fictional, including radiation/day and arbitrary bone indices.
Check-ins and tests override only their astronaut/day, and retain demo provenance.

Data quality gates run before rule interpretation. A baseline needs seven past
adaptation observations. For persistent rules, both raw contemporaneous linked inputs
and consecutive rule-level changes are required. Unknown necessary inputs yield Unknown,
not Nominal. `range:null` avoids presenting arbitrary score spread as a confidence interval.

Triage and medication routing are deterministic and shared between browser and server.
The hosted model is downstream of triage and generates a question-specific answer
from retrieved source summaries and selected-crew data. Citation/schema checks and a
limited output screen precede display; these do not establish clinical correctness.
See [assistant architecture and setup](ASSISTANT.md). Report sending
is never a side effect of asking the assistant. Draft approval and queue simulation are
separate operations. SQLite idempotency prevents duplicate queue records on retries.

External connections use a fixed NASA endpoint and fixed direct OpenAI endpoint or a server-configured, validated Azure OpenAI resource endpoint. Azure keys are not forwarded through redirects and no automatic cross-provider failover occurs. Client input
cannot supply remote URLs. NASA requests are <=1 hour, timeout after15seconds, and bound
response memory to1MB. Bad upstream responses preserve the earlier cache. All units and
observation timestamps survive normalization; naive timestamps are labelled as assumed UTC.

Default API hosting is loopback. Non-loopback startup requires a bearer token. Responses
are no-store; log retention is bounded to1000metadata rows and excludes bodies, tokens and
free-text symptoms. No real health-data deployment is authorized or represented by this demo.
