"""D-055: a REHARMONIZE must move the harmony, not only recolour it. In every
2-bar window of the op at least one new chord's root differs from the old
chord sounding at that bar and beat; roots compare enharmonically, a bar
without a symbol carries the chord before it, and a range with no old chords
is not checked."""
from __future__ import annotations

from score_check import check_edit
from score_fixtures import CHORDS, RECOLOURED, RECOLOURED_TEXT, STYLE
from score_model import Doc
from score_ops import apply_ops
from score_roots import kept_roots, same_root
from scores import strip_chords


def chord(bar, beat, root, quality="maj", bass=None):
    return {"bar": bar, "beat": beat, "root": root, "quality": quality, **({"bass": bass} if bass else {})}


def reharm(a, b, chords):
    return {"op": "REHARMONIZE", "from_bar": a, "to_bar": b, "chords": chords}


# Bar 10 of this copy has no chord symbol, so bar 9's Bb still sounds there.
CARRIED = CHORDS.replace('\n"Bb"z32|"Bb"z32|\n', '\n"Bb"z32|z32|\n', 1)


def test_the_same_roots_with_sevenths_and_slash_basses_are_refused_with_numbers():
    assert kept_roots(Doc(CHORDS), RECOLOURED) == RECOLOURED_TEXT


def test_one_root_change_per_window_passes_even_on_a_later_beat():
    op = reharm(47, 51, [
        chord(47, 1, "D", "m7"), chord(48, 1, "G", "7"),                              # 48: G over Dm
        chord(49, 1, "Bb", "maj7"), chord(50, 1, "Bb", "maj7"), chord(50, 3, "E", "m7b5"),  # 50 beat 3
        chord(51, 1, "B", "m7b5")])                                                    # the odd last bar
    assert kept_roots(Doc(CHORDS), op) is None


def test_an_odd_last_bar_is_its_own_window_and_only_kept_windows_are_named():
    op = reharm(47, 51, [chord(47, 1, "D", "m7"), chord(48, 1, "G", "7"), chord(49, 1, "Bb", "maj7"),
                         chord(50, 1, "Bb", "6"), chord(51, 1, "D", "m7")])
    assert kept_roots(Doc(CHORDS), op) == (
        "REHARMONIZE 47-51 keeps the old root in 4 of 5 bars; change the root in at least one chord per 2 bars "
        "(bars 49-50, 51 keep every root; a 7th or a slash bass on the same root does not count)")


def test_roots_compare_enharmonically():
    assert same_root("Db", "C#") and same_root("A#", "Bb") and same_root("Cb", "B") and not same_root("D", "Db")
    op = reharm(5, 5, [chord(5, 1, "A#", "maj7")])  # old bar 5 is Bb
    assert kept_roots(Doc(CHORDS), op) == (
        "REHARMONIZE 5-5 keeps the old root in 1 of 1 bars; change the root in at least one chord per 2 bars "
        "(bar 5 keeps every root; a 7th or a slash bass on the same root does not count)")


def test_a_bar_without_a_symbol_carries_the_chord_before_it():
    kept = reharm(9, 10, [chord(9, 1, "Bb", "maj7"), chord(10, 1, "A#", "7")])
    assert kept_roots(Doc(CARRIED), kept) is not None
    moved = reharm(9, 10, [chord(9, 1, "Bb", "maj7"), chord(10, 1, "G", "m7")])
    assert kept_roots(Doc(CARRIED), moved) is None
    # Within a bar too: bar 5 is Bb from beat 1, so a beat-3 Bb7 keeps it.
    assert kept_roots(Doc(CHORDS), reharm(5, 5, [chord(5, 1, "Bb"), chord(5, 3, "Bb", "7")])) is not None


def test_a_range_with_no_old_chords_is_not_checked():
    bare = strip_chords(CHORDS)
    assert kept_roots(Doc(bare), RECOLOURED) is None
    # Bar 1 has no chord and none sounds before it.
    assert kept_roots(Doc(CHORDS), reharm(1, 1, [chord(1, 1, "D", "m7")])) is None


def test_check_edit_refuses_a_recoloured_reharmonize_and_keeps_the_other_checks():
    out = apply_ops(CHORDS, STYLE, [RECOLOURED])
    assert out["verdicts"][0]["ok"]
    assert check_edit(CHORDS, out["abc"], [RECOLOURED]) == {"ok": False, "problems": [RECOLOURED_TEXT],
                                                            "differences": []}
