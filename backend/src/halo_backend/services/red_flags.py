"""Red flag rules. These run BEFORE any AI model, so a model mistake cannot hide an emergency.

Plain keyword and number checks. This is a demo list, not a clinical protocol, and it
needs review by a clinician before any real use.
"""

import re
from dataclasses import dataclass


@dataclass(frozen=True)
class RedFlag:
    id: str
    title: str
    steps: tuple[str, ...]


_SYMPTOMS: list[tuple[str, str, re.Pattern[str], tuple[str, ...]]] = [
    ("chest_pain", "Chest pain or pressure",
     re.compile(r"chest (pain|pressure|tightness)|pain in (my )?chest|crushing", re.I),
     ("Stop all activity and rest in a secured position.",
      "Call the crew medical officer now.",
      "Attach the heart monitor and record heart rate, blood pressure and SpO2.",
      "Open the onboard cardiac emergency procedure.")),
    ("breathing", "Trouble breathing",
     re.compile(r"can'?t breathe|cannot breathe|short(ness)? of breath|struggling to breathe|choking", re.I),
     ("Stop activity and call the crew medical officer now.",
      "Check cabin air readings and move to a different module if they are abnormal.",
      "Record SpO2 and breathing rate.",
      "Open the onboard respiratory emergency procedure.")),
    ("stroke_signs", "Possible stroke signs",
     re.compile(r"face (is )?droop|slurred|can'?t speak|cannot speak|lost (my )?speech|"
                r"sudden(ly)? (weak|numb)|one side (of my body )?(is )?(weak|numb)", re.I),
     ("Call the crew medical officer now and note the time symptoms started.",
      "Do not eat, drink or take anything by mouth.",
      "Record blood pressure, heart rate and blood sugar.",
      "Open the onboard neurological emergency procedure.")),
    ("vision_loss", "Sudden vision loss",
     re.compile(r"sudden(ly)? (lost|loss of) (my )?(vision|sight)|can'?t see|went blind|"
                r"lost (my )?(vision|sight)", re.I),
     ("Stop any safety-critical task and call the crew medical officer now.",
      "Note which eye and the time it started.",
      "Do not rub the eye.",
      "Prepare the eye exam kit for an urgent exam.")),
    ("consciousness", "Fainting or confusion",
     re.compile(r"passed out|fainted|blacked out|unconscious|unresponsive|very confused|seizure", re.I),
     ("Call the crew medical officer now.",
      "Secure the crew member and keep the airway clear.",
      "Record SpO2, heart rate, blood pressure and blood sugar.",
      "Open the onboard emergency procedure for altered consciousness.")),
    ("bleeding", "Heavy bleeding",
     re.compile(r"bleeding (a lot|heavily|won'?t stop)|heavy bleeding|vomiting blood|"
                r"coughing (up )?blood", re.I),
     ("Apply firm direct pressure if the source is visible.",
      "Call the crew medical officer now.",
      "Record heart rate and blood pressure every five minutes.",
      "Open the onboard bleeding control procedure.")),
    ("self_harm", "Thoughts of self-harm",
     re.compile(r"kill myself|end my life|suicid|hurt myself|don'?t want to (live|be alive)", re.I),
     ("You are not alone in this. Tell the commander or crew medical officer right now "
      "and stay with a crewmate.",
      "The crew medical officer will open a private priority channel to the flight surgeon "
      "and psychologist.",
      "Crewmates should stay with this person and keep the conversation calm.")),
]

_VITAL_STEPS = (
    "Repeat the measurement now to confirm it.",
    "Call the crew medical officer now.",
    "Stop activity and stay with a crewmate.",
)


def check_red_flags(message: str, vitals: dict[str, float] | None = None) -> list[RedFlag]:
    """Return every red flag found in the message or the latest vitals. Empty means none."""
    found = [RedFlag(i, t, s) for i, t, p, s in _SYMPTOMS if p.search(message)]
    v = vitals or {}
    spo2, temp, hr, sys = v.get("spo2"), v.get("temp_c"), v.get("heart_rate"), v.get("bp_sys")
    if spo2 is not None and spo2 < 90:
        found.append(RedFlag("low_spo2", f"Blood oxygen is {spo2}%", _VITAL_STEPS))
    if temp is not None and temp >= 39.5:
        found.append(RedFlag("high_fever", f"Body temperature is {temp} C", _VITAL_STEPS))
    if hr is not None and (hr > 150 or hr < 35):
        found.append(RedFlag("heart_rate", f"Resting heart rate is {hr} bpm", _VITAL_STEPS))
    if sys is not None and (sys >= 180 or sys < 80):
        found.append(RedFlag("blood_pressure", f"Systolic blood pressure is {sys} mmHg", _VITAL_STEPS))
    return found
