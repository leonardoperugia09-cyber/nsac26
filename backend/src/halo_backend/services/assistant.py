"""The AI medical officer. Order of work for every message.

1. Red flag rules (no AI involved).
2. AI model with a strict system prompt and the astronaut's current data.
3. Safety filter on the model's answer (no drug doses).

With no API key, or if the model call fails, a rule-based answer is returned instead.
Uses only the standard library for the HTTP call so there is no extra dependency.
"""

import json
import logging
import os
import urllib.request

from halo_backend.services.evidence import search_evidence
from halo_backend.services.red_flags import check_red_flags
from halo_backend.services.safety import remove_doses

log = logging.getLogger("halo.assistant")

DISCLAIMER = "HALO is a hackathon prototype, not a medical device."
DELAY = {
    "iss": "Earth link is near real time.",
    "moon": "Earth link has a delay of a few seconds.",
    "mars_transit": "Earth link delay is up to 20 minutes each way.",
}

SYSTEM_PROMPT = """You are HALO, a decision-support assistant for astronauts on a long space mission. You support the crew medical officer. You are not a doctor.

Rules you must always follow:
1. Never give a medication dose, and never tell anyone to start, stop or change a medication. If asked, say the flight surgeon's medication schedule decides that.
2. Never state a diagnosis. Say what the data is consistent with and what would help confirm it.
3. Use only the astronaut data and linked risks given below. Name the signal you relied on. If data is missing or old, say you are not sure and ask for a fresh reading.
4. If a linked risk below matches the question, use its action steps. Do not invent new treatment steps.
5. Ask at most three short follow-up questions when you need more information.
6. Always end with when to involve the crew medical officer or flight surgeon.
7. When an evidence note below is relevant, use it and name its source. Do not cite anything else.
8. Use plain language and short sentences. Under 180 words."""


def _context_block(ctx: dict | None) -> str:
    if not ctx:
        return "No astronaut data was provided."
    lines = [f"Astronaut: {ctx.get('crew_name') or 'unknown'}. Mission day {ctx.get('day') or 'unknown'}. "
             f"Mission: {ctx.get('mission_profile')}."]
    if ctx.get("reading"):
        lines.append(f"Today's reading: {json.dumps(ctx['reading'])}")
    drift = ctx.get("drift") or []
    lines.append(
        "Signals outside this astronaut's normal band: "
        + "; ".join(f"{d['label']} {d['value']} (normal {d['bandLo']} to {d['bandHi']}, {d['status']})" for d in drift)
        if drift else "No signals are outside the normal band."
    )
    risks = ctx.get("risks") or []
    lines.append(
        "Linked risks: " + " | ".join(
            f"{r['name']} [{r['level']}] {r['why']} Steps: {' '.join(r.get('actions', []))} "
            f"Escalation: {r.get('escalate', '')}" for r in risks)
        if risks else "No linked risks are active."
    )
    return "\n".join(lines)


def _fallback(ctx: dict | None) -> str:
    risks = (ctx or {}).get("risks") or []
    if risks:
        r = risks[0]
        return (f"The AI model is not available, so this answer comes from HALO's rules. Your data shows "
                f"{r['name']} at {r['level']} level. {r['why']} Next steps. {' '.join(r.get('actions', [])[:3])}")
    return ("The AI model is not available, and HALO's rules show no active linked risk in your data. "
            "Take a fresh set of vitals, log your symptoms in the Daily Log, and tell the crew medical "
            "officer if the symptom continues or gets worse.")


def _call_model(message: str, history: list[dict], ctx: dict | None, evidence: list[dict]) -> str:
    key = os.getenv("AI_API_KEY")
    if not key:
        raise RuntimeError("AI_API_KEY is not set")
    notes = "\n".join(f"{e['topic']}. {e['note']} (Source. {e['source']})" for e in evidence) or "None matched."
    body = {
        "model": os.getenv("AI_MODEL", "claude-haiku-5-5"),
        "max_tokens": 500,
        "system": f"{SYSTEM_PROMPT}\n\nASTRONAUT DATA\n{_context_block(ctx)}\n\nEVIDENCE NOTES\n{notes}",
        "messages": [*history[-8:], {"role": "user", "content": message}],
    }
    req = urllib.request.Request(
        os.getenv("AI_API_URL", "https://api.anthropic.com/v1/messages"),
        data=json.dumps(body).encode(),
        headers={"content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01"},
    )
    with urllib.request.urlopen(req, timeout=20) as res:  # noqa: S310 fixed https URL from config
        data = json.load(res)
    text = "".join(c.get("text", "") for c in data.get("content", []) if c.get("type") == "text").strip()
    if not text:
        raise RuntimeError("AI API returned no text")
    return text


def answer(message: str, history: list[dict] | None = None, ctx: dict | None = None) -> dict:
    risks = (ctx or {}).get("risks") or []
    evidence = search_evidence(f"{message} {' '.join(r['name'] for r in risks)}")
    profile = (ctx or {}).get("mission_profile", "mars_transit")
    base = {"signalDelay": DELAY.get(profile, DELAY["mars_transit"]), "disclaimer": DISCLAIMER}
    reading = {k: v for k, v in ((ctx or {}).get("reading") or {}).items() if isinstance(v, (int, float))}

    flags = check_red_flags(message, reading)
    if flags:
        text = "\n".join(f"{f.title}. " + " ".join(f"{i + 1}) {s}" for i, s in enumerate(f.steps)) for f in flags)
        return {"kind": "emergency", "source": "red_flag_rules", "text": text,
                "redFlags": [{"id": f.id, "title": f.title, "steps": list(f.steps)} for f in flags],
                "evidence": [], "escalate": "Call the crew medical officer now and send an emergency report to Earth.",
                **base}

    escalate = (risks[0].get("escalate") if risks else "") or "Tell the crew medical officer if this continues or gets worse."
    try:
        text, _ = remove_doses(_call_model(message, history or [], ctx, evidence))
        source = "ai_model"
    except Exception as err:  # any failure falls back to rules, never to silence
        log.warning("Assistant fell back to rules: %s", err)
        text, source = _fallback(ctx), "rule_based_fallback"
    return {"kind": "answer", "source": source, "text": text, "redFlags": [], "evidence": evidence,
            "escalate": escalate, **base}
