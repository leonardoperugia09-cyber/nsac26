"""Safety filter for model output. Removes any sentence that looks like a drug dose."""

import re

_DOSE = re.compile(
    r"\b\d+(\.\d+)?\s?(mg|mcg|µg|ug|g|iu|units?|tablets?|pills?|capsules?|drops?)\b(?!\s?/\s?dL)",
    re.I,
)
_NOTE = "(A sentence with a medication amount was removed. Follow the flight surgeon's medication schedule.)"


def remove_doses(text: str) -> tuple[str, int]:
    parts = re.split(r"(?<=[.!?])\s+", text)
    kept = [p for p in parts if not _DOSE.search(p)]
    removed = len(parts) - len(kept)
    return ((" ".join(kept) + " " + _NOTE) if removed else text, removed)
