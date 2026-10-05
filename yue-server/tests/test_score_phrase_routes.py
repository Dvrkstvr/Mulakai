"""F-026 WRITE_PHRASE on POST /v1/scores/apply: the strict op shape (notes
only, never ABC strings), the reply shape the server's W8 half reads, and
the contract fixtures its fake yue replays (D-039)."""
from __future__ import annotations

import pytest

from contract import check_contract
from score_fixtures import CHORDS, STYLE

TEMPO = {"op": "SET_TEMPO", "bpm": 88}
CHORUS = {"op": "REHARMONIZE", "from_bar": 47, "to_bar": 50, "chords": [
    {"bar": b, "beat": 1, "root": r, "quality": q}
    for b, r, q in [(47, "D", "m7"), (48, "G", "7"), (49, "Bb", "maj7"), (50, "A", "7sus4")]]}


def n(pitch, beats):
    return {"pitch": pitch, "beats": beats}


BARS = [[n("D", 1), n("F", 0.5), n("A", 0.5), n("d", 2)], [n("c", 1), n("A", 1), n("F", 1), n("E", 1)],
        [n("D", 1.5), n("E", 0.5), n("F", 1), n("A", 1)], [n("d", 4)]]
PHRASE = {"op": "WRITE_PHRASE", "start_bar": 57, "instrument": "tenor saxophone", "bars": BARS}
SHORT = {**PHRASE, "bars": [*BARS[:2], [n("D", 1.5), n("E", 1), n("F", 1)], BARS[3]]}
THIN = {**PHRASE, "bars": [[n("D", 4)], [n("F", 4)], [n("A", 4)], [n("z", 4)]]}

CONTRACT = [
    ("apply-write-phrase", [PHRASE]),
    ("apply-write-phrase-compound", [TEMPO, CHORUS, PHRASE]),
    ("apply-write-phrase-vocal-sings", [{**PHRASE, "start_bar": 9}]),
    ("apply-write-phrase-beat-sum", [SHORT]),
    ("apply-write-phrase-sanity", [THIN]),
]


@pytest.mark.parametrize("name,ops", CONTRACT, ids=[c[0] for c in CONTRACT])
def test_contract_replies(name, ops, make_client, record_contract):
    body = {"abc": CHORDS, "style": STYLE, "ops": ops}
    reply = make_client().post("/v1/scores/apply", json=body)
    assert reply.status_code == 200
    check_contract(record_contract, name, "/v1/scores/apply", body, reply)


def apply(client, ops):
    return client.post("/v1/scores/apply", json={"abc": CHORDS, "style": STYLE, "ops": ops}).json()


def test_a_compound_plan_with_a_phrase_applies_and_names_the_instrument_in_the_style(make_client):
    body = apply(make_client(), [TEMPO, CHORUS, PHRASE])
    assert body["ok"] and [v["ok"] for v in body["verdicts"]] == [True, True, True]
    assert body["checks"] == {"ok": True, "problems": [], "differences": []}
    assert body["style"] == "dark pop, 88 bpm, F minor, female vocal, tenor saxophone"
    assert body["changed"] == {"abc": True, "style": True} and body["bpm"] == 88


def test_refusals_come_back_as_a_verdict_reason_or_a_check_problem(make_client):
    client = make_client()
    busy = apply(client, [{**PHRASE, "start_bar": 9}])
    assert busy["ok"] is False and busy["verdicts"][0]["reason"] == "the Vocal sings in bars 11-12; free: 1-10, 47-65"
    assert busy["changed"] == {"abc": False, "style": False}
    short = apply(client, [SHORT])["verdicts"][0]["reason"]
    assert short == "bar 3 of the phrase (score bar 59) sums to 3.5 beats, the meter needs 4 (too short by 0.5)"
    thin = apply(client, [THIN])
    assert thin["ok"] is False and thin["verdicts"][0]["ok"] is True
    assert thin["checks"]["problems"] == ["WRITE_PHRASE bars 57-60: the phrase has 3 notes; write at least 4"]


@pytest.mark.parametrize("change,reason", [
    ({"bars": ["D8F4A4d16", *BARS[1:]]}, "ABC strings are not accepted"),
    ({"bars": "D8F4A4d16|c8A8F8E8|"}, "ABC strings are not accepted"),
    ({"bars": [[n("D", 0.75), n("F", 3.25)], *BARS[1:]]}, "beats must be one of 0.5, 1, 1.5, 2, 3, 4"),
    ({"bars": [[n("C#4", 4)], *BARS[1:]]}, "String should match pattern"),
    ({"bars": [[n("C,'", 4)], *BARS[1:]]}, "String should match pattern"),
    ({"bars": [[n("D4", 4)], *BARS[1:]]}, "String should match pattern"),
    ({"bars": [[{"pitch": "D", "beats": 4, "tie": True}], *BARS[1:]]}, "Extra inputs are not permitted"),
    ({"bars": []}, "at least 1 item"),
    ({"bars": [[], *BARS[1:]]}, "at least 1 item"),
    ({"bars": BARS * 3}, "at most 8 items"),
    ({"instrument": ""}, "at least 1 character"),
    ({"start_bar": 0}, "greater than or equal to 1"),
])
def test_a_malformed_phrase_is_rejected_with_a_reason(change, reason, make_client):
    reply = make_client().post("/v1/scores/apply", json={"abc": CHORDS, "style": STYLE, "ops": [{**PHRASE, **change}]})
    assert reply.status_code == 422
    assert reason in str(reply.json()["detail"])
