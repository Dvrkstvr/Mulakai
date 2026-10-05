"""F-029 TRANSPOSE inside a whole plan (score_plan.py, D-064 a): it runs after
every other op, the section ops and REWRITE_LYRICS included, once per plan,
so their numbers and pitches mean the score as read. Lyrics are never
touched by it, sections move by REPEAT/CUT and every pitch by n, and the
checks of each stage hold together."""
from __future__ import annotations

import pytest

import scores  # noqa: F401  (puts the vendored upstream/ on sys.path)
from abc_tools import VOICES, parse_abc
from contract import check_contract
from lyric_fixtures import LYRICS_2C
from score_fixtures import CHORDS, PARSEABLE, STYLE, library
from score_model import Doc
from score_plan import apply_plan, check_plan
from test_score_transpose import ACCIDENTALS

DOWN = {"op": "TRANSPOSE", "semitones": -2}
REPEAT = {"op": "REPEAT", "section": 3, "label": "chorus"}
NEW = ["paper boats", "on a silver tide", "we never sank", "we only drifted"]
REWRITE = {"op": "REWRITE_LYRICS", "block": 5, "tag": "[Chorus]", "occurrence": 2, "lines": NEW}
CLEAN = {"ok": True, "problems": [], "differences": []}


def run(abc, ops, lyrics=LYRICS_2C, style=STYLE):
    out = apply_plan(abc, style, lyrics, ops)
    return out, check_plan(abc, out, ops)


def assert_moved_by(before_abc: str, after_abc: str, n: int) -> None:
    before, after = parse_abc(before_abc), parse_abc(after_abc)
    for name in VOICES:
        assert [[t, p + n, d] for t, p, d in before.voices[name].notes] == after.voices[name].notes, name
        assert before.voices[name].bars == after.voices[name].bars, name


@pytest.mark.parametrize("ops", [[DOWN, REPEAT], [REPEAT, DOWN]])
def test_transpose_runs_after_a_repeat_whatever_its_place_in_the_plan(ops):
    out, checks = run(CHORDS, ops)
    alone, _ = run(CHORDS, [REPEAT])
    assert [v["ok"] for v in out["verdicts"]] == [True, True] and checks == CLEAN
    assert [s["label"] for s in Doc(out["abc"]).sections] == ["intro", "verse", "chorus", "chorus", "outro"]
    assert_moved_by(alone["abc"], out["abc"], -2)  # the REPEAT's score, every pitch down a tone
    assert out["lyrics"] == alone["lyrics"] != LYRICS_2C  # the chorus block repeated, untouched by TRANSPOSE
    assert "K:Cm" in out["abc"] and "K:Dm" not in out["abc"]
    assert out["style"] == STYLE.replace("F minor", "C minor")


def test_transpose_leaves_rewritten_lyrics_alone():
    out, checks = run(CHORDS, [DOWN, REWRITE])
    rewritten, _ = run(CHORDS, [REWRITE])
    assert [v["ok"] for v in out["verdicts"]] == [True, True] and checks == CLEAN
    assert out["lyrics"] == rewritten["lyrics"] and "\n".join(NEW) in out["lyrics"]
    assert_moved_by(CHORDS, out["abc"], -2)
    assert out["verdicts"][1]["diff"]["new"] == NEW


def test_a_repeated_section_that_changes_key_is_restated_and_moved():
    out, checks = run(ACCIDENTALS, [{"op": "TRANSPOSE", "semitones": 3}, {"op": "CUT", "section": 1, "label": "verse"},
                                    {"op": "REPEAT", "section": 2, "label": "chorus"}], lyrics="")
    assert [v["ok"] for v in out["verdicts"]] == [True, True, True] and checks == CLEAN
    assert_moved_by(run(ACCIDENTALS, [{"op": "CUT", "section": 1, "label": "verse"},
                                      {"op": "REPEAT", "section": 2, "label": "chorus"}], lyrics="")[0]["abc"],
                    out["abc"], 3)
    assert out["abc"].count("V: Vocal\nK:C\n") == 2 and out["abc"].count("[K:F#]") == 4  # A+3 is C, Eb+3 F#


@pytest.mark.parametrize("short_id", PARSEABLE)
def test_every_library_score_repeats_its_last_section_and_transposes_with_clean_checks(short_id):
    abc = library(short_id)
    index, label, *_ = Doc(abc).section_ranges()[-1]
    out, checks = run(abc, [{"op": "TRANSPOSE", "semitones": 5}, {"op": "REPEAT", "section": index, "label": label}],
                      lyrics="")
    assert [v["ok"] for v in out["verdicts"]] == [True, True], out["verdicts"]
    assert checks == CLEAN, checks


def test_one_transpose_per_plan_still_holds_beside_section_ops():
    out, checks = run(CHORDS, [DOWN, REPEAT, {"op": "TRANSPOSE", "semitones": 5}])
    assert [v["ok"] for v in out["verdicts"]] == [True, True, False] and checks == CLEAN
    assert out["verdicts"][2]["reason"] == "only one TRANSPOSE per plan; give the whole shift in one op (-11..11)"


def test_the_transpose_check_runs_against_the_sectioned_score():
    out, _ = run(CHORDS, [REPEAT, DOWN])
    wrong = {**out, "abc": out["abc"].replace("K:Cm", "K:Dm")}
    checks = check_plan(CHORDS, wrong, [REPEAT, DOWN])
    assert not checks["ok"] and checks["problems"] == ["TRANSPOSE -2: the K: lines name Dm, expected Cm"]


def test_contract_reply_for_a_repeat_a_rewrite_and_a_transpose(make_client, record_contract):
    body = {"abc": CHORDS, "style": STYLE, "lyrics": LYRICS_2C, "ops": [DOWN, REPEAT, REWRITE]}
    reply = make_client().post("/v1/scores/apply", json=body)
    assert reply.status_code == 200 and reply.json()["ok"]
    check_contract(record_contract, "apply-transpose-sections", "/v1/scores/apply", body, reply)
