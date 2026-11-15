# HALO conversational assistant

**Azure setup:** see [AZURE.md](AZURE.md) for Microsoft Foundry, the credit offer and provider configuration.

This implementation replaces the earlier sentence-ordering experiment. An existing
language model generates answers to the user's question from a small retrieved
reference library and the selected crew's assessment. It is **not a trained clinical
model**, a validated medical device, or an autonomous flight surgeon.

## What happens on each question

1. The browser checks emergency signs and medication-change requests immediately.
   The API repeats the screen, including symptoms saved in the daily check-in.
   These paths bypass the model. The screen is conservative and incomplete; a negative
   result does not rule out an emergency. Basic English and selected Arabic phrases
   are covered, not comprehensive multilingual triage.
2. Deterministic BM25 retrieval selects up to six authored claim passages from the
   seven-source, version-controlled library. The search has topic expansions and can
   use the last two user questions for short follow-ups. It is not full-text paper
   search. Unsupported questions explicitly abstain.
3. With explicit session consent and server configuration, the OpenAI Chat Completions
   endpoint (Azure OpenAI or direct OpenAI, selected server-side) receives the question, at most six prior conversation turns, relevant
   passages with population/limitations, and the selected crew/day's simulated
   measurements, baseline comparisons and rule results. Direct crew identifiers and
   names are omitted from the context; identifiers typed by the user are not redacted.
   Raw measurements are separate from engine values, which can be recent averages.
4. The model returns structured paragraphs, passage IDs, signal keys, uncertainties
   and follow-up questions. HALO checks schema, citation membership and a limited
   high-risk output screen. Sources are linked from the local registry, never from
   model-invented URLs. Prompt injection content is placed in an untrusted data
   envelope, not promoted to a system message. These measures do not eliminate
   hallucination, prompt injection or medical errors. Citation membership is not an
   entailment check and does not prove the prose is supported.
5. Missing credentials, opt-out, provider errors, timeouts, refusals and invalid output
   produce an explicitly labelled fallback. The fallback is a reference excerpt or
   demonstration readout, not a generated answer. No flight-surgeon report is sent.

The API does not persist chat history or log question/provider bodies. The browser
keeps conversation in component memory and clears it on astronaut/day change or a
new conversation. This is not identity-based access control. Existing API access is
prototype service-token access to fictional records.

## Enable and verify locally

For Azure, use [AZURE.md](AZURE.md). For direct OpenAI, copy the root `.env.example` to `.env`, set `AI_PROVIDER=openai`, and set:

- `AI_API_KEY`: a project-scoped OpenAI API key, stored only on the API server.
- `HALO_MODEL`: a model ID available to that project that supports Chat Completions
  structured outputs. No model ID or paid subscription is assumed by the code.

`npm run server` loads the root `.env` if present; exported variables take precedence.
Run `npm run dev:full`, open Assistant, and enable **Use hosted AI for this session**.
Ask a supported question, for example: “What does the evidence say about sleep
in space?” A real successful response must say **AI-generated answer** and include
sources. The initial status only verifies configuration, not provider connectivity.

Run `npm run check:ai` for an **intentional live call that can incur API usage**.
It exits 0 only after an actual generated answer, exits 1 on provider/generation
failure, and exits 2 when credentials/model are missing. Automated tests use simulated
provider responses and do not prove live model access. ChatGPT subscription access
is not used by this server; supply an API project key.

Never place an API key in a VITE-prefixed environment variable, browser Settings,
source files, commits or chat. Settings accepts the prototype backend service token,
not the OpenAI key. `store:false` is sent to the provider; this is not a promise of
zero provider retention. Review provider data controls before using real health data.

## Connect a deployed frontend

A static Cloudflare frontend does not run this Node/Fastify + SQLite server.
Deploy the API on a Node 22.13+ host with persistent storage and HTTPS, configure
`HALO_API_TOKEN`, `AI_API_KEY`, `HALO_MODEL`, and `HALO_ALLOWED_ORIGINS` (the frontend's
exact origin), then either:

- Route same-origin `/api/*` to the API host with a reverse proxy; or
- Set `VITE_API_BASE_URL=https://YOUR-API-HOST/api` in the frontend build environment,
  rebuild the frontend, and enter the backend service token in Settings.

The browser now rejects HTML responses from API routes with a deployment diagnostic.
The site must provide a JSON response at `GET /api/assistant/status`; a 200 HTML
app-shell response is not a working API. A 405 POST at `/api/assistant` means the
assistant route is not deployed there. The UI distinguishes fallback from successful
model generation. No Cloudflare deployment or live model verification is implied by
merging the code.

The endpoint has a 12-request/minute limit. Provider calls have a ten-second timeout,
1,800-completion-token cap, and a 64-KiB response bound, without automatic paid retries.

## Improve the knowledge base before considering training

Add domain-reviewed source summaries with stable IDs, populations, supported claims,
limitations and source URLs to `backend/resources/evidence.json`. The retrieval index
rebuilds on server startup. Add representative questions and expected supporting
sources to the tests. Obtain medical review of answer quality and escalation behavior.
The current seven-source library is intentionally small and domain review is pending.

Fine-tuning is not currently implemented. It could later improve a narrow behavior
using licensed, de-identified, expert-labelled examples and a separate evaluation set.
Do not train on the synthetic crew dataset as if it supplied clinical diagnoses. Keep
current evidence and individual readings in retrieval rather than treating training
as a way to guarantee factual answers.

Provider output format follows the official [Structured Outputs documentation](https://developers.openai.com/api/docs/guides/structured-outputs).
