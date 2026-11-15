# HALO AI service

A small Cloudflare Worker that lets the hosted website (which has no server) ask Claude. It exists so the API key never
reaches the browser.

- **What it does.** The browser builds the question, the person's readings and the matching source summaries, and posts
  them to `/claude`. The service adds HALO's fixed system prompt and answer format, calls Claude Opus 5.5 and returns the
  answer. The browser then checks it (unknown citations, dose or diagnosis wording, links) and falls back to the
  on-board source answers if anything is wrong.
- **What it will not do.** Callers cannot change the model, the prompt or the token limit; only the question, the context
  and the evidence are used, and all three are size-checked.
- **Limits** (`src/logic.ts`, `LIMITS`): 5 answers per visitor per 10 minutes, 25 per visitor per day, 40 per hour in
  total, 3 at once, and 200 answers in total (counted at about 15 cents each, so about 30 dollars). The counters live in a
  Durable Object so concurrent callers cannot overshoot. When a limit is reached the website says so and answers from
  its sources.
- **Secret.** `ANTHROPIC_API_KEY` is a Worker secret; it is not in this repository. Deploy with
  `cf deploy --secrets-file <file containing ANTHROPIC_API_KEY=...>`.
- **Tests.** `npm test` at the repository root (`backend/tests/aiservice.test.ts`).
