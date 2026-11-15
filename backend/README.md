# HALO backend structure

Python + FastAPI scaffold for the HALO research prototype. This branch establishes
the structure so features can be implemented together, one module at a time.

**Implemented now:** startup, configuration, CORS allowlist, `GET /health`, and the
assistant stack under `/api/v1`.

| Endpoint | What it does |
|---|---|
| `POST /api/v1/assistant` | Red flag rules first, then the AI model with the crew member's data and evidence notes, then a filter that removes drug doses. Falls back to rules with no key. |
| `GET /api/v1/evidence?q=` | Offline evidence pack (13 sourced notes), keyword search. |
| `POST /api/v1/report` | Drafts the report for the flight surgeon. Never sends anything. |
| `GET /api/v1/radlab` and `POST /api/v1/radlab/refresh` | NASA RadLab dose data, cached in `radlab_snapshot.json`. |

Set `AI_API_KEY` (and optionally `AI_MODEL`, `AI_API_URL`) in the shell to use a real model.
The browser keeps scoring and coupling rules in `src/engine`; it sends the results as context.

## Setup

From the repository root, with Python 3.12 or newer:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
python -m pip install -e ".[dev]"
uvicorn halo_backend.main:app --reload --host 127.0.0.1 --port 8000
```

On Windows PowerShell use `.venv\Scripts\Activate.ps1` to activate the environment.
Open http://127.0.0.1:8000/docs for interactive API documentation and
http://127.0.0.1:8000/health for the liveness check.

No API key is needed to start the scaffold. `.env.example` is a template; variables
are read from the process environment and `.env` is not automatically loaded. Do not
commit credentials. Keep this development service bound to localhost; authentication
and production hosting will be addressed before adding sensitive-data endpoints.

## Structure

```text
backend/
  pyproject.toml                  # dependencies, packaging and tooling
  .env.example                   # configuration template with no credentials
  src/halo_backend/
    main.py                      # application factory
    core/                        # settings; future authentication and logging
    api/
      routes/health.py           # the only implemented route
      v1/endpoints/              # future versioned feature endpoints
    schemas/                     # future request/response contracts
    services/                    # future workflow logic
    providers/                   # future NASA and AI clients/cache
    adapters/                    # future simulator/frontend mapping
    resources/                   # future reviewed evidence/action-card files
  tests/                         # startup and configuration checks
  docs/                          # ownership, data mapping and feature roadmap
```

## Checks

Run from `backend/` after installation:

```bash
python -m pytest -q
ruff check .
ruff format --check .
```

## Next implementation steps

1. Agree on input/output schemas using `../src/engine/types.ts`.
2. Adapt `../data/crew_sim.json` into explicitly simulated demo requests.
3. Implement NASA radiation ingestion and a labelled cached fallback.
4. Build the evidence registry and retrieval service.
5. Add constrained AI explanation and structured report drafting.
6. Integrate browser offline behavior and the remaining feature areas.

See [architecture](docs/ARCHITECTURE.md), [data integration](docs/DATA_INTEGRATION.md)
and [feature coverage](docs/FEATURE_COVERAGE.md). This branch does not include the
earlier standalone implementation; the folders are reserved for subsequent work.
