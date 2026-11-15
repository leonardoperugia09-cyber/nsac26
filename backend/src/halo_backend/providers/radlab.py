"""NASA OSDR RadLab radiation data, cached in a snapshot file so the app works offline.

Source. https://visualization.osdr.nasa.gov/radlab/gui/data-api
"""

import json
import os
import urllib.request
from datetime import UTC, datetime
from pathlib import Path

SNAPSHOT = Path(os.getenv("HALO_RADLAB_SNAPSHOT", Path(__file__).resolve().parents[3] / "radlab_snapshot.json"))
# One day of ISS DosTel readings. Change the dates to pull a different window.
QUERY = "?spacecraft=ISS&instrument=DosTel&timestamp>=2022-04-01T00:00&timestamp<2022-04-02T00:00&absorbed_dose_rate&format=tsv"


def read_snapshot() -> dict | None:
    return json.loads(SNAPSHOT.read_text(encoding="utf8")) if SNAPSHOT.exists() else None


def parse_tsv(text: str) -> list[dict]:
    lines = [ln for ln in text.splitlines() if ln.strip() and not ln.startswith("#")]
    header = [h.strip() for h in lines[0].split("\t")]
    ti = next((i for i, h in enumerate(header) if "timestamp" in h.lower()), -1)
    di = next((i for i, h in enumerate(header) if "absorbed_dose_rate" in h.lower()), -1)
    if ti < 0 or di < 0:
        raise ValueError(f"Unexpected RadLab columns: {header}")
    rows = []
    for ln in lines[1:]:
        c = ln.split("\t")
        try:
            rows.append({"timestamp": c[ti], "absorbed_dose_rate": float(c[di])})
        except (ValueError, IndexError):
            continue
    if not rows:
        raise ValueError("RadLab returned no usable rows")
    return rows


def refresh_snapshot() -> dict:
    base = os.getenv("RADLAB_API_BASE", "https://visualization.osdr.nasa.gov/radlab/api/")
    with urllib.request.urlopen(base + QUERY, timeout=30) as res:  # noqa: S310 configured NASA URL
        rows = parse_tsv(res.read().decode("utf8"))
    snap = {"source": "NASA OSDR RadLab, ISS DosTel", "query": base + QUERY,
            "fetched_at": datetime.now(UTC).isoformat(), "unit": "check against the RadLab docs", "rows": rows}
    SNAPSHOT.write_text(json.dumps(snap, indent=1), encoding="utf8")
    return snap
