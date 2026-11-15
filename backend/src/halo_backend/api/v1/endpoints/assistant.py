from fastapi import APIRouter, HTTPException

from halo_backend.providers.radlab import read_snapshot, refresh_snapshot
from halo_backend.schemas.assistant import AssistantRequest, ReportRequest
from halo_backend.services.assistant import answer
from halo_backend.services.evidence import load_evidence, search_evidence
from halo_backend.services.report import draft_report

router = APIRouter(tags=["assistant"])


@router.post("/assistant")
def assistant(req: AssistantRequest) -> dict:
    """Red flags first, then the model, then the dose filter. Never fails closed on emergencies."""
    return answer(req.message, [t.model_dump() for t in req.history],
                  req.context.model_dump() if req.context else None)


@router.get("/evidence")
def evidence(q: str = "") -> list[dict]:
    return search_evidence(q) if q.strip() else load_evidence()


@router.post("/report")
def report(req: ReportRequest) -> dict:
    """A draft only. Nothing is sent. The crew member reviews it first."""
    return {"report": draft_report(req.context.model_dump(), req.complaint), "sent": False}


@router.get("/radlab")
def radlab() -> dict:
    snap = read_snapshot()
    if snap is None:
        raise HTTPException(503, "No RadLab snapshot yet. POST /api/v1/radlab/refresh while online.")
    return snap


@router.post("/radlab/refresh")
def radlab_refresh() -> dict:
    try:
        snap = refresh_snapshot()
    except Exception as err:
        raise HTTPException(502, f"Could not reach RadLab. {err}") from err
    return {"ok": True, "rows": len(snap["rows"]), "fetched_at": snap["fetched_at"]}
