from halo_backend.providers.radlab import parse_tsv
from halo_backend.schemas.assistant import AssistantRequest
from halo_backend.services.assistant import answer
from halo_backend.services.evidence import search_evidence
from halo_backend.services.red_flags import check_red_flags
from halo_backend.services.report import draft_report
from halo_backend.services.safety import remove_doses

KIDNEY_CTX = {
    "crew_name": "Marco Ricci", "day": 60, "mission_profile": "mars_transit",
    "reading": {"heart_rate": 69, "spo2": 98, "temp_c": 37.1},
    "drift": [{"label": "Fluid intake", "value": 1475, "bandLo": 2546, "bandHi": 3160, "status": "far outside"}],
    "risks": [{"name": "Kidney stone risk", "level": "Act", "why": "Low fluid and high sodium.",
               "actions": ["Drink water over the next hour."], "escalate": "Tell the CMO if pain is severe."}],
}


def test_emergencies_are_caught_before_any_model(monkeypatch):
    monkeypatch.delenv("AI_API_KEY", raising=False)
    for msg in ["I have crushing chest pain", "I can't breathe", "his face is drooping and speech slurred",
                "I suddenly lost vision in my right eye", "she fainted", "I don't want to be alive"]:
        r = answer(msg)
        assert r["kind"] == "emergency" and r["source"] == "red_flag_rules", msg


def test_dangerous_vitals_raise_flags():
    assert check_red_flags("hello", {"spo2": 85})[0].id == "low_spo2"
    assert check_red_flags("hello", {"spo2": 97, "temp_c": 37}) == []


def test_normal_message_is_not_an_emergency(monkeypatch):
    monkeypatch.delenv("AI_API_KEY", raising=False)
    assert answer("my back aches a bit", ctx=KIDNEY_CTX)["kind"] == "answer"


def test_fallback_uses_the_linked_risk(monkeypatch):
    monkeypatch.delenv("AI_API_KEY", raising=False)
    r = answer("why am I being warned?", ctx=KIDNEY_CTX)
    assert r["source"] == "rule_based_fallback"
    assert "Kidney stone risk" in r["text"] and r["escalate"] == "Tell the CMO if pain is severe."
    assert r["evidence"]


def test_dose_sentences_are_removed():
    text, removed = remove_doses("Rest well. Take 400 mg of ibuprofen. Drink water.")
    assert removed == 1 and "400" not in text and "Drink water." in text
    assert remove_doses("Glucose is 92 mg/dL today.")[1] == 0


def test_evidence_search_and_report():
    assert search_evidence("my urine is dark and my flank hurts")[0]["id"] == "kidney"
    rep = draft_report(KIDNEY_CTX, "flank pain")
    assert "Kidney stone risk [Act]" in rep and "flank pain" in rep and "Fluid intake" in rep


def test_radlab_parser():
    rows = parse_tsv("# comment\ntimestamp\tabsorbed_dose_rate\n2022-04-01T00:00\t1.5\n2022-04-01T00:01\tbad\n")
    assert rows == [{"timestamp": "2022-04-01T00:00", "absorbed_dose_rate": 1.5}]


def test_request_schema_rejects_empty_message():
    import pytest
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        AssistantRequest(message="")
