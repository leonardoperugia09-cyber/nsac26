"""Drafts the report for the flight surgeon. Plain template, no AI, so it is always available.

A draft is not approval to send it. The crew member reviews and sends it themselves.
"""

DELAY = {"iss": "near real time", "moon": "a few seconds", "mars_transit": "up to 20 minutes each way"}


def draft_report(ctx: dict, complaint: str | None = None) -> str:
    r = ctx.get("reading") or {}
    drift = ctx.get("drift") or []
    risks = ctx.get("risks") or []
    profile = ctx.get("mission_profile", "mars_transit")

    def g(key: str) -> str:
        return str(r.get(key, "not logged"))

    lines = [
        "HALO CREW HEALTH REPORT (prototype, not a medical device)",
        f"Crew member. {ctx.get('crew_name', 'unknown')}",
        f"Mission day {ctx.get('day', 'unknown')}. Profile {profile}. "
        f"Signal delay {DELAY.get(profile, DELAY['mars_transit'])}.",
        "",
        f"Reported by crew. {(complaint or '').strip() or 'No symptom reported.'}",
        "",
        f"Vitals today. HR {g('heart_rate')} bpm, BP {g('bp_sys')}/{g('bp_dia')} mmHg, "
        f"temp {g('temp_c')} C, SpO2 {g('spo2')}%, glucose {g('glucose_mg_dl')} mg/dL.",
        f"Sleep {g('sleep_hours')} h. Mood {g('mood_1to5')}/5. Stress {g('stress_1to5')}/5.",
        f"Radiation today {g('radiation_mSv_today')} mSv. Mission total {g('radiation_mSv_total')} mSv.",
        "",
        "Signals outside personal baseline.",
        *([f"  {d['label']}. {d['value']} (normal {d['bandLo']} to {d['bandHi']}). {d['status']}."
           for d in drift] or ["  None."]),
        "",
        "Linked risks.",
        *([f"  {k['name']} [{k['level']}]. {k['why']} First step given to crew. "
           f"{(k.get('actions') or ['none'])[0]}" for k in risks] or ["  None active."]),
        "",
        "Requested from flight surgeon. Review and advise. "
        "Medication decisions are left to the flight surgeon.",
    ]
    return "\n".join(lines)
