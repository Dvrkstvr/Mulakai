"""F-030 REPEAT / CUT and F-031 REWRITE_LYRICS on POST /v1/scores/apply: the
strict op shapes, `lyrics` in and out, seconds per section for the cut hint,
and the contract fixtures the server's fake yue replays (D-039)."""
from __future__ import annotations

import ast
from pathlib import Path

import pytest

from contract import check_contract
from lyric_fixtures import LYRICS_2C, LYRICS_38, LYRICS_F3
from score_fixtures import CHORDS, METER, STYLE, library

REPEAT = {"op": "REPEAT", "section": 3, "label": "chorus"}
CUT = {"op": "CUT", "section": 4, "label": "outro"}
NEW = ["paper boats", "on a silver tide", "we never sank", "we only drifted"]
REWRITE = {"op": "REWRITE_LYRICS", "block": 5, "tag": "[Chorus]", "occurrence": 2, "lines": NEW}
TEMPO = {"op": "SET_TEMPO", "bpm": 90}

CONTRACT = [
    ("apply-repeat", CHORDS, LYRICS_2C, [REPEAT]),
    ("apply-repeat-seam", library("f3e3bfdc"), LYRICS_F3, [REPEAT]),
    ("apply-repeat-wrong-label", CHORDS, LYRICS_2C, [{**REPEAT, "section": 2}]),
    ("apply-repeat-no-lyrics", CHORDS, None, [REPEAT]),
    ("apply-repeat-compound", CHORDS, LYRICS_2C, [TEMPO, REPEAT, REWRITE]),
    ("apply-cut", CHORDS, LYRICS_2C, [CUT]),
    ("apply-cut-unmatched-block", METER, LYRICS_38, [{"op": "CUT", "section": 6, "label": "outro"}]),
    ("apply-cut-last-section", CHORDS, LYRICS_2C, [{"op": "CUT", "section": s, "label": l}
                                                    for s, l in [(1, "intro"), (2, "verse"), (3, "chorus"),
                                                                 (4, "outro")]]),
    ("apply-rewrite-lyrics", CHORDS, LYRICS_2C, [REWRITE]),
    ("apply-rewrite-lyrics-wrong-block", CHORDS, LYRICS_2C, [{**REWRITE, "block": 3}]),
    ("apply-rewrite-lyrics-line-count", CHORDS, LYRICS_2C, [{**REWRITE, "lines": NEW[:3]}]),
    ("apply-rewrite-lyrics-tag", CHORDS, LYRICS_2C, [{**REWRITE, "lines": ["[Chorus]", *NEW[1:]]}]),
]


def body(abc, lyrics, ops):
    return {"abc": abc, "style": STYLE, **({"lyrics": lyrics} if lyrics is not None else {}), "ops": ops}


@pytest.mark.parametrize("name,abc,lyrics,ops", CONTRACT, ids=[c[0] for c in CONTRACT])
def test_contract_replies(name, abc, lyrics, ops, make_client, record_contract):
    request = body(abc, lyrics, ops)
    reply = make_client().post("/v1/scores/apply", json=request)
    assert reply.status_code == 200
    check_contract(record_contract, name, "/v1/scores/apply", request, reply)


def test_a_repeat_returns_the_lyrics_and_seconds_per_section(make_client):
    reply = make_client().post("/v1/scores/apply", json=body(CHORDS, LYRICS_2C, [TEMPO, REPEAT, REWRITE])).json()
    assert reply["ok"] and [v["ok"] for v in reply["verdicts"]] == [True, True, True]
    assert reply["changed"] == {"abc": True, "style": False, "lyrics": True}  # the style already says 90 bpm
    assert [(s["label"], s["from_bar"], s["to_bar"]) for s in reply["sections"]] == [
        ("intro", 1, 10), ("verse", 11, 46), ("chorus", 47, 62), ("chorus", 63, 78), ("outro", 79, 81)]
    assert reply["sections"][-1]["seconds"] == round(3 * 4 * 60 / 90, 1) == 8.0
    assert reply["seconds"] == round(81 * 4 * 60 / 90, 1) and reply["tokens"] == len(reply["abc"])
    assert reply["verdicts"][2]["diff"]["new"] == NEW and "lyric block 3 [Chorus]" in reply["verdicts"][1]["note"]


def test_lyrics_are_null_in_the_reply_when_none_were_sent(make_client):
    reply = make_client().post("/v1/scores/apply", json=body(CHORDS, None, [TEMPO])).json()
    assert reply["ok"] and reply["lyrics"] is None and reply["changed"]["lyrics"] is False


@pytest.mark.parametrize("op", [
    {"op": "REPEAT", "section": 3}, {**REPEAT, "section": 0}, {**REPEAT, "label": ""}, {**REPEAT, "times": 2},
    {"op": "CUT", "label": "outro"}, {**REWRITE, "lines": []}, {**REWRITE, "lines": ["a"] * 33},
    {**REWRITE, "occurrence": 0}, {**REWRITE, "block": 0}, {k: v for k, v in REWRITE.items() if k != "tag"},
    {**REWRITE, "lines": ["x" * 201, "b", "c", "d"]},
])
def test_malformed_section_and_lyric_ops_are_a_422(op, make_client):
    assert make_client().post("/v1/scores/apply", json=body(CHORDS, LYRICS_2C, [op])).status_code == 422


@pytest.mark.parametrize("module", ["score_sections", "score_section_check", "score_lyrics", "score_plan",
                                    "score_section_models"])
def test_the_section_modules_import_nothing_from_the_model_or_pipeline(module):
    tree = ast.parse((Path(__file__).parent.parent / f"{module}.py").read_text(encoding="utf-8"))
    imported = {alias.name.split(".")[0] for node in ast.walk(tree) if isinstance(node, ast.Import)
                for alias in node.names}
    imported |= {node.module.split(".")[0] for node in ast.walk(tree)
                 if isinstance(node, ast.ImportFrom) and node.module}
    assert not imported & {"torch", "yue2", "yue_pipeline", "worker", "jobs", "transcriber", "instrumental"}
