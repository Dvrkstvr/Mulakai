"""F-017 #1 and #2: SP-2's golden cases give upstream's ok/error text through
the validator and the read route; an overfull bar also gets its unit sum."""
from __future__ import annotations

import pytest

from score_check import bar_sums, verdict
from score_fixtures import BROKEN, CHORDS, GOLDEN, METER, PARSEABLE, library
from score_model import Doc
from scores import parse_abc


def upstream(text: str) -> tuple[bool, str | None]:
    try:
        parse_abc(text)
        return True, None
    except ValueError as error:
        return False, str(error)


def test_the_golden_file_holds_every_spike_case():
    names = [c["name"] for c in GOLDEN]
    assert len(names) == len(set(names)) == 37  # 10 library sidecars + 27 mutations (SP-2 golden.py)
    assert sum(n.startswith("library:") for n in names) == 10
    assert len(PARSEABLE) == 9


@pytest.mark.parametrize("case", GOLDEN, ids=[c["name"] for c in GOLDEN])
def test_golden_case_matches_upstream(case):
    got = verdict(case["text"])
    assert (got["ok"], got["error"]) == upstream(case["text"])
    assert got["ok"] == case["ok"]
    assert got["error"] == case.get("error")


def test_the_read_route_gives_the_golden_text(make_client):
    client = make_client()
    for case in GOLDEN:
        body = client.post("/v1/scores/read", json={"abc": case["text"]}).json()
        assert (body["ok"], body["error"]) == (case["ok"], case.get("error")), case["name"]


def test_the_truncated_library_sidecar_is_refused_with_upstreams_message(make_client):
    body = make_client().post("/v1/scores/read", json={"abc": BROKEN}).json()
    assert body["ok"] is False
    assert body["error"] == "group 60, Ins: expected V: Ins"
    assert body["facts"] is None and body["seconds"] is None


def test_an_overfull_bar_reports_its_unit_sum():
    text = CHORDS.replace("D4A4f4A4e4A4e4A4|", "D4A4f4A4e4A4e4A4A4|", 1)
    got = verdict(text)
    assert got["error"] == "group 1, Ins, bar 3: event after the measure end"
    assert got["bar_sums"] == [{"bar": 3, "voice": "Ins", "units": 36, "expected": 32}]
    assert got["messages"] == ["bar 3 (Ins): 36 of 32 units, too long by 4"]


def test_an_underfull_bar_and_a_meter_change_report_their_own_lengths():
    short = verdict(CHORDS.replace("D4A4f4A4e4A4e4A4|", "D4A4f4A4e4A4e4A3|", 1))
    assert short["messages"] == ["bar 3 (Ins): 31 of 32 units, too short by 1"]
    # 3820c535 opens in 2/4 (16 units a bar) before its groups switch to 4/4.
    two_four = METER.replace("z12z3B|B4A4G4F4|", "z12z3B|B4A4G4F4B4|", 1)
    assert verdict(two_four)["bar_sums"] == [{"bar": 2, "voice": "Ins", "units": 20, "expected": 16}]


def test_a_valid_score_has_no_bar_sums():
    assert all(bar_sums(library(name)) == [] for name in PARSEABLE)


@pytest.mark.parametrize("name", PARSEABLE)
def test_the_model_writes_every_library_sidecar_back_byte_for_byte(name):
    text = library(name)
    assert Doc(text).text() == text
