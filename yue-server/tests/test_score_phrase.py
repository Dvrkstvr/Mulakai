"""F-026 WRITE_PHRASE (yue-server half): code writes the planner's {pitch,
beats} notes as ABC into the Ins voice, only where the Vocal rests, refuses
bad sums and busy bars with numbers, and the sanity gates after compare."""
from __future__ import annotations

from fractions import Fraction

import pytest

from score_bars import emit_bar, note_count
from score_check import check_edit
from score_fixtures import CHORDS, PARSEABLE, RECOLOURED, RECOLOURED_TEXT, SIXTEENTH, STYLE, library
from score_model import Doc, OpError
from score_ops import apply_ops
from score_phrase import add_instrument, note_events
from scores import parse_abc


def n(pitch, beats):
    return {"pitch": pitch, "beats": beats}


def phrase(start, bars, instrument="tenor saxophone"):
    return {"op": "WRITE_PHRASE", "start_bar": start, "instrument": instrument, "bars": bars}


# 2c944049 is D minor, 4/4, L:1/32: one beat is 8 units; the Vocal rests in bars 1-10 and 47-65.
GOOD = [[n("D", 1), n("F", 0.5), n("A", 0.5), n("d", 2)],
        [n("c", 1), n("A", 1), n("F", 1), n("E", 1)],
        [n("D", 1.5), n("E", 0.5), n("F", 1), n("A", 1)],
        [n("d", 4)]]


def test_a_phrase_is_written_into_ins_in_the_scores_units_and_the_edit_checks_clean():
    out = apply_ops(CHORDS, STYLE, [phrase(5, GOOD)])
    assert out["verdicts"] == [{"index": 1, "op": "WRITE_PHRASE", "ok": True, "reason": None}]
    doc = Doc(out["abc"])
    assert [emit_bar(doc.bar(b, "Ins")) for b in range(5, 9)] == ["D8F4A4d16", "c8A8F8E8", "D12E4F8A8", "d32"]
    assert [doc.bar(b, "Vocal") for b in range(1, 66)] == [Doc(CHORDS).bar(b, "Vocal") for b in range(1, 66)]
    assert check_edit(CHORDS, out["abc"], [phrase(5, GOOD)]) == {"ok": True, "problems": [], "differences": []}
    assert out["style"] == f"{STYLE}, tenor saxophone"


def test_only_the_ins_lines_of_the_phrase_bars_change():
    out = apply_ops(CHORDS, STYLE, [phrase(5, GOOD)])
    changed = [(a, b) for a, b in zip(CHORDS.splitlines(), out["abc"].splitlines()) if a != b]
    assert 1 <= len(changed) <= 2 and all(a.count("|") == b.count("|") for a, b in changed)


def test_a_bar_whose_beats_do_not_fill_the_meter_is_refused_with_the_numbers():
    bars = [GOOD[0], GOOD[1], [n("D", 1.5), n("E", 1), n("F", 1)], [n("d", 4), n("A", 1)]]
    out = apply_ops(CHORDS, STYLE, [phrase(5, bars)])
    assert out["verdicts"][0]["ok"] is False and out["abc"] == CHORDS and out["style"] == STYLE
    assert out["verdicts"][0]["reason"] == (
        "bar 3 of the phrase (score bar 7) sums to 3.5 beats, the meter needs 4 (too short by 0.5); "
        "bar 4 of the phrase (score bar 8) sums to 5 beats, the meter needs 4 (too long by 1)")


def test_a_phrase_over_bars_where_the_vocal_sings_is_refused_naming_the_free_bars():
    out = apply_ops(CHORDS, STYLE, [phrase(9, GOOD)])
    assert out["verdicts"][0]["reason"] == "the Vocal sings in bars 11-12; free: 1-10, 47-65"
    one = apply_ops(CHORDS, STYLE, [phrase(8, GOOD)])["verdicts"][0]["reason"]
    assert one == "the Vocal sings in bar 11; free: 1-10, 47-65"


def test_a_phrase_past_the_last_bar_is_refused():
    reason = apply_ops(CHORDS, STYLE, [phrase(63, GOOD)])["verdicts"][0]["reason"]
    assert reason == "a 4-bar phrase at bar 63 runs past the last bar (65)"


def test_beats_become_allowed_lengths_tied_where_one_length_cannot_hold_them():
    assert note_events(n("^F", 1.5), 32) == [["note", "^", "F", "", 12, "", "12"]]
    assert note_events(n("c'", 4), 64) == [["note", "", "c", "'", 48, "-", "48"], ["note", "", "c", "'", 16, "", "16"]]
    assert note_events(n("z", 4), 64) == [["note", "", "z", "", 48, "", "48"], ["note", "", "z", "", 16, "", "16"]]
    with pytest.raises(OpError, match=r"a 0.5-beat note does not fit the score's unit L:1/4"):
        note_events(n("D", 0.5), 4)


def test_a_tie_from_the_bar_before_the_phrase_is_undone_at_the_seam():
    # 83921775 (L:1/16, F#m): Ins bar 2 ends tied into bar 3.
    before = Doc(SIXTEENTH).bar(2, "Ins")
    assert before[-1][5] == "-"
    bars = [[n("F", 1), n("A", 1), n("c", 1), n("A", 1)], [n("B", 2), n("G", 2)],
            [n("A", 1), n("c", 1), n("e", 2)], [n("f", 4)]]
    out = apply_ops(SIXTEENTH, "", [phrase(3, bars, "flute")])
    assert out["verdicts"][0]["ok"], out["verdicts"]
    assert Doc(out["abc"]).bar(2, "Ins")[-1][5] == ""
    assert check_edit(SIXTEENTH, out["abc"], [phrase(3, bars, "flute")])["ok"]
    assert out["style"] == "flute"


def test_a_note_after_the_phrase_that_kept_a_tied_accidental_is_reported_when_it_would_change_pitch():
    # Ins bar 8 ends with a C# tied into bar 9, whose unmarked c only sounds C# through the tie.
    doc = Doc(CHORDS)
    doc.edit(8, "Ins")[:] = [["note", "^", "c", "", 24, "", "24"], ["note", "", "c", "", 8, "-", "8"]]
    doc.edit(9, "Ins")[:] = [["note", "", "c", "", 8, "", "8"], ["note", "", "z", "", 24, "", "24"]]
    tied = doc.text()
    out = apply_ops(tied, STYLE, [phrase(5, GOOD)])
    assert out["verdicts"][0]["ok"]
    assert check_edit(tied, out["abc"], [phrase(5, GOOD)])["problems"] == [
        "WRITE_PHRASE bars 5-8: the Ins note at bar 9 changes pitch once the tie into it is cut; "
        "end the phrase a bar earlier or later"]


def test_an_inline_key_in_a_replaced_ins_bar_is_kept():
    doc = Doc(CHORDS)
    for voice in ("Vocal", "Ins"):
        doc.edit(5, voice).insert(0, ["key", "Dm"])
    keyed = doc.text()
    parse_abc(keyed)
    out = apply_ops(keyed, STYLE, [phrase(5, GOOD)])
    assert out["verdicts"][0]["ok"] and Doc(out["abc"]).bar(5, "Ins")[0] == ["key", "Dm"]
    assert check_edit(keyed, out["abc"], [phrase(5, GOOD)])["ok"]


def test_the_instrument_is_appended_once_and_survives_a_later_edit_style():
    assert add_instrument("dark pop, Tenor Saxophone", "tenor saxophone") == "dark pop, Tenor Saxophone"
    assert add_instrument("", "sax") == "sax"
    out = apply_ops(CHORDS, STYLE, [phrase(5, GOOD), {"op": "EDIT_STYLE", "style": "jazz trio, 120 bpm"}])
    assert out["style"] == "jazz trio, 87 bpm, tenor saxophone"
    refused = apply_ops(CHORDS, STYLE, [phrase(9, GOOD)])
    assert refused["style"] == STYLE


def gates(bars, start=5):
    out = apply_ops(CHORDS, STYLE, [phrase(start, bars)])
    assert out["verdicts"][0]["ok"], out["verdicts"]
    return check_edit(CHORDS, out["abc"], [phrase(start, bars)])


@pytest.mark.parametrize("bars,problem", [
    ([[n("D", 4)], [n("F", 4)], [n("A", 4)], [n("z", 4)]],
     "WRITE_PHRASE bars 5-8: the phrase has 3 notes; write at least 4"),
    ([[n("D", 2), n("F", 2)], [n("D", 2), n("F", 2)], [n("F", 2), n("D", 2)], [n("D", 4)]],
     "WRITE_PHRASE bars 5-8: the phrase uses 2 distinct pitches; use at least 3"),
    ([[n("^C", 1), n("^D", 1), n("^F", 1), n("^G", 1)], [n("D", 1), n("E", 1), n("F", 1), n("G", 1)],
      [n("^c", 1), n("^d", 1), n("^f", 1), n("^g", 1)], [n("d", 4)]],
     "WRITE_PHRASE bars 5-8: 5 of 13 notes (38%) are in the key Dm; keep at least 70% in the key"),
    ([[n("D", 1), n("F", 1), n("A", 1), n("d", 1)]] * 4,
     "WRITE_PHRASE bars 5-8: the same bar is written 4 times; vary the bars"),
])
def test_each_sanity_gate_refuses_with_its_reason(bars, problem):
    assert gates(bars) == {"ok": False, "problems": [problem], "differences": []}


def test_the_sanity_gates_wait_until_the_earlier_checks_pass():
    thin = phrase(57, [[n("D", 4)], [n("F", 4)], [n("A", 4)], [n("z", 4)]])
    out = apply_ops(CHORDS, STYLE, [RECOLOURED, thin])
    assert [v["ok"] for v in out["verdicts"]] == [True, True]
    assert check_edit(CHORDS, out["abc"], [RECOLOURED, thin])["problems"] == [RECOLOURED_TEXT]


def window(doc: Doc, size: int = 4) -> int | None:
    free = [b for b in range(1, doc.nbars() + 1) if not note_count(doc.bar(b, "Vocal"))]
    return next((b for b in free if all(b + k in free for k in range(size))), None)


def key_phrase(doc: Doc, start: int) -> list[list[dict]]:
    """SP-2's oracle phrase (run.py ref_phrase): key degrees 1-3-5-8, one beat each, rotated per bar."""
    letters = "CDEFGAB"
    root = letters.index(doc.key[0])
    degrees = [letters[root], letters[(root + 2) % 7], letters[(root + 4) % 7], letters[root].lower()]
    out = []
    for i in range(4):
        beats = int(Fraction(doc.units_per_bar(start + i)) / doc.units_per_quarter())
        out.append([n(degrees[(i + j) % 4], 1) for j in range(beats)])
    return out


@pytest.mark.parametrize("song", PARSEABLE)
def test_golden_an_in_key_phrase_applies_and_checks_clean_on_every_library_score(song):
    abc = library(song)
    doc = Doc(abc)
    start = window(doc)
    op = phrase(start, key_phrase(doc, start))
    out = apply_ops(abc, "pop", [op])
    assert out["verdicts"][0]["ok"], out["verdicts"]
    assert check_edit(abc, out["abc"], [op]) == {"ok": True, "problems": [], "differences": []}
    assert parse_abc(out["abc"]).voices["Vocal"].notes == parse_abc(abc).voices["Vocal"].notes
