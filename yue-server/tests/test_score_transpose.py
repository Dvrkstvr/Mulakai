"""F-029 TRANSPOSE: SP-2's selftest (the 9 library scores upstream accepts x 6
intervals: every sounding pitch exactly +n, every K: line and chord root
moved, the bar grid and rhythm unchanged), accidentals and ties as upstream
reads them, the refusals, the style's key text, and the route's contract
fixtures the server's fake yue replays (D-039)."""
from __future__ import annotations

import pytest

import scores  # noqa: F401  (puts the vendored upstream/ on sys.path)
from abc_tools import KEYS, VOICES
from contract import check_contract
from score_check import check_edit
from score_fixtures import CHORDS, PARSEABLE, STYLE, library
from score_ops import apply_ops
from score_roots import pitch_class
from score_transpose import chord_class, new_key, sync_style_key
from scores import parse_abc

INTERVALS = (-5, -2, -1, 1, 2, 7)
DOWN_A_TONE = {"op": "TRANSPOSE", "semitones": -2}
TEMPO = {"op": "SET_TEMPO", "bpm": 88}

# A group K: line, an inline [K:], accidentals that carry by letter, a tie
# that keeps its accidental across the bar line, a natural sign, slash chords.
HEADER = ['X:1', 'T:', 'M:4/4', 'L:1/8', 'Q:1/4=100', 'V: Vocal clef=treble name="Vocal Melody" snm="Vocal"',
          'V: Ins clef=treble name="Ins Melody" snm="Inst."', 'K:Dm']
ACCIDENTALS = "\n".join(HEADER + [
    "% verse", "V: Vocal", '"Dm"D2^C2D2C2|"Gm/Bb"_B2B2A2^G2-|"A7"G2=B2^c2-c2|',
    "V: Ins", "Z|D,4^F,4|z8|",
    "% chorus", "V: Vocal", "K:A", '"A"A2B2c2d2|[K:Eb]"Eb"E2=E2F2G2|',
    "V: Ins", "K:A", "c8|[K:Eb]e8|"]) + "\n"


def transposed(abc: str, n: int) -> str:
    out = apply_ops(abc, "", [{"op": "TRANSPOSE", "semitones": n}])
    assert out["verdicts"][0]["ok"], out["verdicts"]
    return out["abc"]


def assert_moved(abc: str, n: int) -> None:
    before, after_text = parse_abc(abc), transposed(abc, n)
    after = parse_abc(after_text)  # round trip: upstream accepts the transposed score
    for name in VOICES:
        a, b = before.voices[name], after.voices[name]
        assert [[t, p + n, d] for t, p, d in a.notes] == b.notes, name
        assert a.bars == b.bars, name
        assert [(t, new_key(k, n)) for t, k in a.keys] == b.keys, name
        assert [(t, (pitch_class(k.removesuffix("m")) + n) % 12) for t, k in a.keys] == \
               [(t, pitch_class(k.removesuffix("m"))) for t, k in b.keys]
    old, new = before.voices["Vocal"].chords, after.voices["Vocal"].chords
    assert [t for t, _ in old] == [t for t, _ in new]
    for (_, was), (_, now) in zip(old, new):
        root, quality, bass = chord_class(was)
        assert chord_class(now) == ((root + n) % 12, quality, None if bass is None else (bass + n) % 12)
    assert check_edit(abc, after_text, [{"op": "TRANSPOSE", "semitones": n}]) == \
           {"ok": True, "problems": [], "differences": []}


@pytest.mark.parametrize("n", INTERVALS)
@pytest.mark.parametrize("short_id", PARSEABLE)
def test_every_pitch_key_and_chord_root_moves_by_n_in_the_library_scores(short_id, n):
    assert len(PARSEABLE) == 9
    assert_moved(library(short_id), n)


@pytest.mark.parametrize("n", range(-11, 12))
def test_accidentals_ties_and_every_kind_of_key_line_move_exactly(n):
    if n:
        assert_moved(ACCIDENTALS, n)


def test_every_K_line_is_rewritten_and_spelled_in_the_new_key():
    text = transposed(ACCIDENTALS, -2)
    lines = text.splitlines()
    assert lines[7] == "K:Cm" and lines.count("K:G") == 2 and text.count("[K:Db]") == 2
    # Cm's B and A are flat: B natural and A natural are marked once per bar and
    # carry; Bb (the key's A-flat now) needs no mark; the tie keeps F# across the bar.
    assert lines[10] == '"Cm"C2=B,2C2B,2|"Fm/Ab"A2A2G2^F2-|"G7"^F2=A2=B2-B2|'
    assert lines[12] == "Z|C,4=E,4|z8|"
    assert lines[16:] == ['"G"G2A2B2c2|[K:Db]"Db"D2=D2E2F2|', "V: Ins", "K:G", "B8|[K:Db]d8|"]


def test_the_new_key_is_one_of_the_30_names_with_the_tonic_moved():
    for key in KEYS:
        for n in range(-11, 12):
            moved = new_key(key, n)
            assert moved in KEYS and moved.endswith("m") == key.endswith("m")
            assert pitch_class(moved.removesuffix("m")) == (pitch_class(key.removesuffix("m")) + n) % 12
    assert [new_key("C", n) for n in (1, 3, 6, 8, 10, 11)] == ["Db", "Eb", "F#", "Ab", "Bb", "B"]


def test_refusals_come_back_as_verdict_reasons_and_leave_the_score_alone():
    zero = apply_ops(CHORDS, STYLE, [{"op": "TRANSPOSE", "semitones": 0}])
    assert zero["abc"] == CHORDS and zero["verdicts"][0]["reason"] == \
        "semitones is 0, which changes nothing; give -11..-1 (down) or 1..11 (up)"
    twice = apply_ops(CHORDS, STYLE, [DOWN_A_TONE, {"op": "TRANSPOSE", "semitones": 5}])
    assert [v["ok"] for v in twice["verdicts"]] == [True, False]
    assert twice["verdicts"][1]["reason"] == "only one TRANSPOSE per plan; give the whole shift in one op (-11..11)"
    low = ACCIDENTALS.replace("Z|D,4^F,4|", "Z|C,,,,,4^F,4|")
    out = apply_ops(low, "", [{"op": "TRANSPOSE", "semitones": -1}])
    assert out["abc"] == low and out["verdicts"][0]["reason"] == \
        "a note would move to MIDI pitch -1, outside 0-127; transpose the other way"
    with pytest.raises(ValueError, match="the key Dorian is not one of upstream's 30 key names"):
        new_key("Dorian", 2)


def test_the_style_key_names_the_new_key_and_other_ops_run_in_the_old_key():
    out = apply_ops(CHORDS, STYLE, [DOWN_A_TONE, TEMPO])
    assert out["style"] == "dark pop, 88 bpm, C minor, female vocal"
    assert parse_abc(out["abc"]).bpm == 88
    assert sync_style_key("rock, Bb major, F# minor bridge", "Ebm") == "rock, Eb minor, Eb minor bridge"
    assert sync_style_key("a minor change, female vocal", "Ebm") == "a minor change, female vocal"
    assert apply_ops(CHORDS, "", [DOWN_A_TONE])["style"] == ""
    chorus = {"op": "REHARMONIZE", "from_bar": 47, "to_bar": 48, "chords": [
        {"bar": 47, "beat": 1, "root": "G", "quality": "m7"}, {"bar": 48, "beat": 1, "root": "A", "quality": "7"}]}
    both = apply_ops(CHORDS, STYLE, [DOWN_A_TONE, chorus])
    chords = parse_abc(both["abc"]).voices["Vocal"].chords
    bars = parse_abc(both["abc"]).voices["Vocal"].bars
    assert [c for t, c in chords if t in (bars[46][0], bars[47][0])] == ["Fm7", "G7"]
    assert check_edit(CHORDS, both["abc"], [DOWN_A_TONE, chorus])["ok"]


def test_check_edit_flags_a_transpose_that_moved_a_pitch_wrongly():
    wrong = transposed(CHORDS, -2).replace("K:Cm", "K:Dm")
    checks = check_edit(CHORDS, wrong, [DOWN_A_TONE])
    assert not checks["ok"] and "TRANSPOSE -2: the K: lines name Dm, expected Cm" in checks["problems"]


CONTRACT = [
    ("apply-transpose", [DOWN_A_TONE]),
    ("apply-transpose-compound", [DOWN_A_TONE, TEMPO]),
    ("apply-transpose-zero", [{"op": "TRANSPOSE", "semitones": 0}]),
]


@pytest.mark.parametrize("name,ops", CONTRACT, ids=[c[0] for c in CONTRACT])
def test_contract_replies(name, ops, make_client, record_contract):
    body = {"abc": CHORDS, "style": STYLE, "ops": ops}
    reply = make_client().post("/v1/scores/apply", json=body)
    assert reply.status_code == 200
    check_contract(record_contract, name, "/v1/scores/apply", body, reply)


@pytest.mark.parametrize("semitones", [12, -12, 24, 1.5, "up"])
def test_a_shift_outside_the_schema_bounds_is_a_422(semitones, make_client):
    body = {"abc": CHORDS, "style": STYLE, "ops": [{"op": "TRANSPOSE", "semitones": semitones}]}
    reply = make_client().post("/v1/scores/apply", json=body)
    assert reply.status_code == 422 and "semitones" in str(reply.json()["detail"])
