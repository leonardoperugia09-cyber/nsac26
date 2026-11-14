"""Offline evidence pack. Short plain-language notes with sources, searched by keyword."""

import json
from functools import lru_cache
from pathlib import Path

_FILE = Path(__file__).resolve().parent.parent / "resources" / "evidence.json"


@lru_cache(maxsize=1)
def load_evidence() -> list[dict]:
    return json.loads(_FILE.read_text(encoding="utf8"))


def search_evidence(text: str, limit: int = 3) -> list[dict]:
    t = text.lower()
    scored = [(sum(k in t for k in e["keywords"]), e) for e in load_evidence()]
    scored = [x for x in scored if x[0] > 0]
    scored.sort(key=lambda x: -x[0])
    return [e for _, e in scored[:limit]]
