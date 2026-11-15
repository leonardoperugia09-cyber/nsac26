# NASA evidence and full papers for the assistant (design, 2026-11-15)

## Why
Ben: make the AI "even better, more accurate, feed it real info from NASA research papers". Today the assistant may only answer from 7 sources with 11 short claims, so many questions get "not covered" or generic text. Ben chose both curated NASA evidence and full papers.

## Goals
- 12-15 new sources across HALO's risks: renal stones, SANS and vision, orthostatic intolerance, bone, muscle, radiation, sleep and fatigue, immune, nutrition, medicines, behavioural health, fluid shift.
- Curated claims (40-60) in `backend/resources/evidence.json`, same format as today (population, claims, limitations, `domain_review_pending`), each claim checked against the source text.
- Full text stored and searched only where the licence allows reuse: NASA/US-government works (public domain) and open-access papers (CC BY, CC BY-NC, CC0). Copyrighted papers: curated claims and a link only.
- The Evidence page lists every source with its licence; the References list is updated.

## Non-goals
- No live web search at question time (HALO is an offline crew medical officer).
- No clinical validation claims; review status stays "pending".
- No PDFs committed to the repo: only extracted, cleaned text with attribution.

## Approach (Ben picked curated evidence plus full papers)
- Downloads go to a new empty folder outside the repo (untrusted data). Text extraction with the installed `pypdf` (Python run with `-I`), script kept in a separate folder. Output: `backend/resources/papers/<id>.json` with `{ id, title, url, licence, authors, year, topics, chunks: [{ id, text }] }`, chunks of about 900 characters, references and page furniture removed.
- `backend/node/retrieval.ts`: index curated claims plus full-text chunks; precompute term counts so search stays fast with thousands of chunks; full-text passages carry the limitation "verbatim excerpt from the full paper, not reviewed by HALO"; a minimum match score so weak matches count as "not covered" instead of feeding the model unrelated text.
- `backend/node/assistant-model.ts` system prompt: evidence can be an authored summary or a verbatim excerpt; cite only what the passage says.
- Frontend: Evidence page shows the new sources (it already reads `evidence.json`); full texts stay server-side (bundle size unchanged).

## Checks
- Every source has a working URL and a licence; every full-text file has a reuse licence.
- Tests: every rule's evidence ids still resolve; retrieval finds the right source for 12 topic questions; weak queries return nothing; search over the full corpus answers in under 50 ms.
- Before and after: the same 10 questions offline, and 3-4 live with Claude.
