# Connect HALO to Azure OpenAI

Azure provider support is implemented. No Azure subscription, resource or model was
created by these code changes, and no credit was redeemed or spent. A configured
endpoint is not proof that a real model request succeeds.

## 1. Redeem and inspect the offer first

The [NASA Space Apps 2026 Global Offers page](https://www.spaceappschallenge.org/2026/global-offers/)
shows a Microsoft Azure offer. The supplied offer screenshot directs eligible new
customers to **Claim Offer → Try Azure for Free**, with **$200 credit usable within
30 days**. This matches Microsoft's public free-account offer, rather than evidence
of a separate unconditional NASA credit grant. Existing-customer eligibility, identity
verification and activation must be checked with Microsoft.

Open [Azure Portal](https://portal.azure.com/), sign in, and inspect **Subscriptions**.
Confirm an active subscription, credit balance and expiration in the billing/credits
view. Account creation or seeing the NASA offer page alone does not confirm credits
have been activated. Do not put account numbers, payment details, redemption codes or
API keys into the repository or chat.

Model availability depends on subscription eligibility, region and available quota;
credit balance alone does not prove deployability. If model deployment shows no quota
or asks for a subscription change, record the non-secret error and inspect eligibility.
Do not assume that upgrading billing automatically grants the desired model access.

## 2. Choose a deployment and review its cost

In [Microsoft Foundry](https://ai.azure.com/), select the credited Azure subscription.
Choose an Azure OpenAI resource/model that supports **Chat Completions v1 and structured
outputs**. A small model such as `gpt-4.1-mini` is a candidate if it is currently offered
in your subscription/region; availability and pricing must be confirmed there. This
is an educational demo, not a medically validated model recommendation.

Use a consumption/pay-per-token deployment if available for the selected model. Avoid
provisioned-throughput reservations for this prototype unless intentionally approved.
Before creating resources or making a live call, inspect the displayed regional/model
prices and confirm the chosen service's charges are eligible for your credit.

Estimate a request using current prices:

`input_tokens / 1,000,000 × input_price + output_tokens / 1,000,000 × output_price`

The backend caps completion output at 1,800 tokens per request, limits the assistant
endpoint to 12 requests/minute, and does not automatically retry a paid provider call.
These are per-request/per-minute limits, **not** an Azure dollar spending cap. Hosting,
storage and other resources have separate charges. There is no implemented guarantee
that $200 covers any particular number of days or requests. Keep the free-account
spending protection unless you intentionally accept different billing terms.

After review, give the model deployment a clear name, for example `halo-assistant`.
The deployment name is an Azure alias: it can differ from the underlying model ID.
The backend sends this exact alias in the request's `model` field.

## 3. Configure the server privately

Copy the root `.env.example` to a local `.env`, or set equivalent server environment
variables in your backend host:

```dotenv
AI_PROVIDER=azure
AZURE_OPENAI_ENDPOINT=https://YOUR-RESOURCE.openai.azure.com/
AZURE_OPENAI_DEPLOYMENT=halo-assistant
AZURE_OPENAI_API_KEY=YOUR-RESOURCE-KEY
```

The endpoint must be the Azure resource root or its `/openai/v1/` base URL. Both
`*.openai.azure.com` and `*.services.ai.azure.com` resource hosts are accepted.
Do not paste a project URL such as `/api/projects/...`, a Playground URL or an entire
`/chat/completions` URL. The adapter normalizes the v1 path once.

The server uses an `api-key` header with Azure v1. Direct OpenAI uses a Bearer header
and remains supported through `AI_PROVIDER=openai`, `AI_API_KEY` and `HALO_MODEL`.
Keys never fall back between providers, and Azure failure never silently switches to
OpenAI. HTTPS resource URLs are validated and redirects are rejected before a key
could be forwarded elsewhere. Client requests cannot choose the provider or endpoint.

Managed-identity/Entra authentication is not implemented by this adapter; this first
version uses a server-side Azure resource key. Never use `VITE_` prefixes for secrets.
Local `.env` files are ignored by Git. The frontend service token in Settings is the
HALO API token, not the Azure resource key.

## 4. Verify configuration, then perform a deliberate live check

Run `npm run dev:full`. Assistant's **AI connection** panel should report configured.
`GET /api/assistant/status` exposes the selected provider, deployment name and a
configuration-only status. It does not expose the key or endpoint, and does not make
a billable provider request. Missing or invalid configuration is reported explicitly.

After cost/access review, run:

```bash
npm run check:ai
```

This command makes one intentional Azure model request and may consume credit. It
exits 0 only after an actual generated answer, exits 1 for provider/output failures,
and exits 2 without making a request when configuration is missing or invalid.
Automated Azure tests use simulated provider responses, not a real Azure deployment.

In Assistant, enable **Use hosted AI for this session**. The consent text identifies
Azure OpenAI. Questions, up to six conversation turns, relevant source passages and
selected-crew simulated data are sent to the chosen provider; avoid identifying health
data. Emergency/medication-change paths bypass the model. Generated answers can be
wrong; citation and safety screens are incomplete.

Failure diagnostics distinguish authentication (401), access denial (403), missing
resource/deployment (404), rate/quota limits (429), unsupported requests (400), provider
failures and timeout. A 429 does not necessarily mean the dollar credit is exhausted.
Provider error bodies are not echoed because they may contain sensitive details.

## 5. Connect the public website separately

The Cloudflare frontend does not run the Node/Fastify API merely because Azure AI is
configured. Run the API on a suitable Node 22.13+ host, configure persistent storage
and the service token, and connect `/api` or build with `VITE_API_BASE_URL` as described
in [ASSISTANT.md](ASSISTANT.md). No Azure hosting resource is provisioned here.
Do not put SQLite on an Azure Storage network mount; it is not a supported locking
strategy. Select a suitable database/storage design before scaling the backend.

## References checked during implementation

- [NASA Global Offers](https://www.spaceappschallenge.org/2026/global-offers/) — supplied screenshot confirms the $200/30-day offer wording.
- [Azure free account](https://azure.microsoft.com/en-us/free/) — eligibility, credit period and account choices.
- [Azure OpenAI v1 API](https://learn.microsoft.com/en-us/azure/foundry/openai/api-version-lifecycle) — resource base URL and deployment-name convention.
- [Structured outputs](https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/structured-outputs) — JSON Schema support and model compatibility.
- [Azure OpenAI REST reference](https://learn.microsoft.com/en-us/azure/foundry/openai/latest) — provider request contract.
- [App Service storage mounts](https://learn.microsoft.com/en-us/azure/app-service/containers/how-to-serve-content-from-azure-storage) — SQLite/network-locking limitation.
