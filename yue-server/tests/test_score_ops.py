"""F-017 #3: SET_TEMPO, REHARMONIZE and EDIT_STYLE, each checked with
upstream's parser and compare (the melody never moves)."""
from __future__ import annotations

from score_check import check_edit
from score_fixtures import BY_NAME, CHORDS, METER, SIXTEENTH, STYLE
from score_ops import QUALITIES, ROOTS, apply_ops, sync_style_bpm
from scores import parse_abc


def chord(bar, beat, root, quality="maj", bass=None):
    return {"bar": bar, "beat": beat, "root": root, "quality": quality, **({"bass": bass} if bass else {})}


def reharm(a, b, chords):
    return {"op": "REHARMONIZE", "from_bar": a, "to_bar": b, "chords": chords}


def changed_lines(before: str, after: str) -> list[tuple[str, str]]:
    return [(x, y) for x, y in zip(before.splitlines(), after.splitlines()) if x != y]


def test_the_enums_are_the_17_roots_and_upstreams_15_native_qualities():
    assert len(ROOTS) == 17 and len(set(ROOTS)) == 17
    assert len(QUALITIES) == 15 and QUALITIES[0] == "maj"


def test_set_tempo_rewrites_q_and_the_style_bpm_together():
    out = apply_ops(CHORDS, STYLE, [{"op": "SET_TEMPO", "bpm": 88}])
    assert out["verdicts"] == [{"index": 1, "op": "SET_TEMPO", "ok": True, "reason": None}]
    assert "Q:1/4=88\n" in out["abc"] and out["style"] == "dark pop, 88 bpm, F minor, female vocal"
    assert changed_lines(CHORDS, out["abc"]) == [("Q:1/4=87", "Q:1/4=88")]
    assert parse_abc(out["abc"]).bpm == 88
    assert check_edit(CHORDS, out["abc"], [{"op": "SET_TEMPO", "bpm": 88}])["ok"]


def test_set_tempo_appends_a_bpm_when_the_style_names_none():
    assert apply_ops(CHORDS, "dark pop", [{"op": "SET_TEMPO", "bpm": 120}])["style"] == "dark pop, 120 bpm"
    assert sync_style_bpm("lofi, 90 BPM", 70, append=False) == "lofi, 70 BPM"
    assert sync_style_bpm("lofi", 70, append=False) == "lofi"


def test_reharmonize_replaces_the_chords_of_rest_bars():
    ops = [reharm(5, 6, [chord(5, 1, "Bb", "maj7"), chord(5, 3, "G", "m7"), chord(6, 1, "C", "7")])]
    out = apply_ops(CHORDS, STYLE, ops)
    assert out["verdicts"][0]["ok"] and out["style"] == STYLE
    assert changed_lines(CHORDS, out["abc"]) == [
        ('"Bb"z32|"Bb"z32|"Dm"z32|"Dm"z32|', '"Bbmaj7"z16"Gm7"z16|"C7"z32|"Dm"z32|"Dm"z32|')]
    check = check_edit(CHORDS, out["abc"], ops)
    assert check == {"ok": True, "problems": [], "differences": []}


def test_reharmonize_splits_a_sung_note_with_a_tie_and_the_vocal_melody_is_unchanged():
    ops = [reharm(43, 43, [chord(43, 1, "G", "m7"), chord(43, 4, "A", "7")])]
    out = apply_ops(CHORDS, STYLE, ops)
    assert '"Gm7"a8g8f4e4-"A7"e4d4-|' in out["abc"]  # the bar's own tie into bar 44 survives
    assert check_edit(CHORDS, out["abc"], ops)["ok"]


def test_reharmonize_follows_per_group_meter_and_sixteenth_units():
    # 3820c535: bars 1-2 are 2/4, so beat 3 does not exist there; bar 3 is 4/4.
    two_four = apply_ops(METER, STYLE, [reharm(2, 2, [chord(2, 1, "C"), chord(2, 3, "D")])])
    assert two_four["verdicts"][0]["reason"] == "bar 2: beat 3 is outside the bar (2 beats)"
    four_four = apply_ops(METER, STYLE, [reharm(3, 3, [chord(3, 1, "C"), chord(3, 3, "D")])])
    assert '"C"z16"D"z16|' in four_four["abc"]
    # 83921775 is L:1/16: a quarter is 4 units, so beat 3 is 8 units in.
    ops = [reharm(2, 2, [chord(2, 1, "A"), chord(2, 3, "D", "maj", bass="F#")])]
    sixteenth = apply_ops(SIXTEENTH, STYLE, ops)
    assert '"A"z8"D/F#"z4z4|' in sixteenth["abc"]
    assert check_edit(SIXTEENTH, sixteenth["abc"], ops)["ok"]


def test_reharmonize_refusals_name_the_op_and_the_reason():
    cases = [
        (reharm(998, 999, [chord(998, 1, "C")]), "bars 998-999 are outside the score (1-65)"),
        (reharm(5, 6, [chord(5, 1, "C")]), "no chord given for bar 6; give a beat-1 chord for every bar 5-6"),
        (reharm(5, 5, [chord(5, 2, "C")]), "bar 5 has no beat-1 chord"),
        (reharm(5, 5, [chord(5, 1, "C"), chord(5, 1, "D")]), "bar 5 has two chords on beat 1"),
        (reharm(5, 5, [chord(5, 1, "C"), chord(5, 5, "D")]), "bar 5: beat 5 is outside the bar (4 beats)"),
        (reharm(5, 5, [chord(5, 1, "C"), chord(9, 1, "D")]), "a chord at bar 9 is outside bars 5-5"),
        (reharm(1, 17, [chord(b, 1, "C") for b in range(1, 18)]), "covers 17 bars; at most 16 at a time"),
    ]
    for op, reason in cases:
        out = apply_ops(CHORDS, STYLE, [op])
        assert out["verdicts"] == [{"index": 1, "op": "REHARMONIZE", "ok": False, "reason": reason}]
        assert out["abc"] == CHORDS


def test_a_failed_op_leaves_the_score_as_it_was_and_the_others_still_apply():
    out = apply_ops(CHORDS, STYLE, [{"op": "SET_TEMPO", "bpm": 88}, reharm(999, 999, [chord(999, 1, "C")])])
    assert [v["ok"] for v in out["verdicts"]] == [True, False]
    assert changed_lines(CHORDS, out["abc"]) == [("Q:1/4=87", "Q:1/4=88")]


def test_an_op_that_fails_half_way_leaves_no_trace(monkeypatch):
    import score_ops

    def half_then_fail(doc, style, op):
        doc.edit(5, "Vocal").insert(0, ["chord", "C"])
        doc.set_bpm(60)
        raise score_ops.OpError("gave up")

    monkeypatch.setitem(score_ops.OPS, "REHARMONIZE", half_then_fail)
    out = apply_ops(CHORDS, STYLE, [reharm(5, 5, [chord(5, 1, "C")])])
    assert out["abc"] == CHORDS and out["verdicts"][0]["reason"] == "gave up"


def test_lines_no_op_touched_keep_their_own_spelling():
    spaced = BY_NAME["mut:trailing spaces in a music line"]["text"]   # "Z2| D4A4..." is valid
    crlf = BY_NAME["mut:CRLF line endings"]["text"]
    for text, newline in [(spaced, "\n"), (crlf, "\r\n")]:
        out = apply_ops(text, STYLE, [{"op": "SET_TEMPO", "bpm": 88}, reharm(5, 5, [chord(5, 1, "C")])])["abc"]
        assert changed_lines(text, out) == [("Q:1/4=87", "Q:1/4=88"),
                                            ('"Bb"z32|"Bb"z32|"Dm"z32|"Dm"z32|', '"C"z32|"Bb"z32|"Dm"z32|"Dm"z32|')]
        assert out.count(newline) == text.count(newline)


def test_edit_style_replaces_the_style_and_keeps_its_bpm_in_step_with_q():
    out = apply_ops(CHORDS, STYLE, [{"op": "EDIT_STYLE", "style": "jazz trio, brushed drums"}])
    assert out["style"] == "jazz trio, brushed drums" and out["abc"] == CHORDS
    both = apply_ops(CHORDS, STYLE, [{"op": "SET_TEMPO", "bpm": 88},
                                     {"op": "EDIT_STYLE", "style": "jazz trio, 120 bpm"}])
    assert both["style"] == "jazz trio, 88 bpm"
    alone = apply_ops(CHORDS, STYLE, [{"op": "EDIT_STYLE", "style": "jazz trio, 120 bpm"}])
    assert alone["style"] == "jazz trio, 87 bpm"  # the score's Q: is what renders
    empty = apply_ops(CHORDS, STYLE, [{"op": "EDIT_STYLE", "style": "   "}])
    assert empty["verdicts"][0]["reason"] == "the style is empty" and empty["style"] == STYLE


def test_check_edit_catches_a_moved_melody_and_chords_changed_outside_the_window():
    ops = [reharm(5, 6, [chord(5, 1, "C"), chord(6, 1, "C")])]
    edited = apply_ops(CHORDS, STYLE, ops)["abc"]
    moved = edited.replace('"Dm"d8d8d2c6d4c2d2|', '"Dm"d8d8d2c6d4c2c2|', 1)
    got = check_edit(CHORDS, moved, ops)
    assert not got["ok"]
    assert got["differences"] == ["Vocal: sounding notes differ starting at note 7 (pitch, onset or duration)"]
    stray = edited.replace('"Dm"d8d8d2c6d4c2d2|', '"Gm"d8d8d2c6d4c2d2|', 1)
    assert check_edit(CHORDS, stray, ops)["problems"] == ["chords changed outside the REHARMONIZE bars: bar 11"]
    slow = check_edit(CHORDS, CHORDS.replace("Q:1/4=87", "Q:1/4=80"), [{"op": "SET_TEMPO", "bpm": 88}])
    assert slow["problems"] == ["Q: is 80, expected 88"]
    assert check_edit(CHORDS, CHORDS.replace("Q:1/4=87", "Q:1/4=80"), [])["differences"] == [
        "quarter-note tempo differs"]
