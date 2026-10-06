"""F-026 WRITE_PHRASE accidentals (M1 review finding 1): the planner writes a
plain letter for the key signature's note, but in ABC (and upstream's
parse_bar) an accidental lasts to the end of the bar, by letter across
octaves. Code owns the ABC, so it spells each note so upstream parses the
pitch the planner meant: an explicit accidental where a plain letter would
inherit a different one, none where it would not."""
from __future__ import annotations

import scores  # noqa: F401  (puts the vendored upstream/ on sys.path)
from abc_tools import NATURAL, key_accidentals
from score_bars import emit_bar
from score_check import check_edit
from score_fixtures import CHORDS, SIXTEENTH, STYLE
from score_model import Doc
from score_ops import apply_ops
from score_phrase import note_events, spell_bar
from scores import parse_abc

ALTER = {"^": 1, "_": -1, "=": 0}


def n(pitch, beats):
    return {"pitch": pitch, "beats": beats}


def phrase(start, bars, instrument="tenor saxophone"):
    return {"op": "WRITE_PHRASE", "start_bar": start, "instrument": instrument, "bars": bars}


def intended(pitch: str, key: str) -> int:
    """The MIDI pitch the planner means: a plain letter is the key's note."""
    acc = pitch[0] if pitch[0] in ALTER else ""
    letter = pitch[len(acc)]
    marks = pitch[len(acc) + 1:]
    midi = 60 + NATURAL[letter.upper()] + (12 if letter.islower() else 0) + 12 * (marks.count("'") - marks.count(","))
    return midi + (ALTER[acc] if acc else key_accidentals(key)[letter.upper()])


def sounded(abc: str, start: int, count: int) -> list[int]:
    """Upstream's sounding Ins pitches in bars start..start+count-1."""
    ins = parse_abc(abc).voices["Ins"]
    begin = ins.bars[start - 1][0]
    end = ins.bars[start + count - 2][0] + ins.bars[start + count - 2][1]
    return [pitch for onset, pitch, _ in ins.notes if begin <= onset < end]


def applied(abc: str, start: int, bars: list[list[dict]], keys: list[str]) -> tuple[dict, list[str]]:
    out = apply_ops(abc, STYLE, [phrase(start, bars)])
    assert out["verdicts"][0]["ok"], out["verdicts"]
    assert sounded(out["abc"], start, len(bars)) == [
        intended(note["pitch"], key) for notes, key in zip(bars, keys) for note in notes if note["pitch"] != "z"]
    doc = Doc(out["abc"])
    return out, [emit_bar(doc.bar(start + k, "Ins")) for k in range(len(bars))]


TAIL = [[n("D", 1), n("E", 1), n("F", 1), n("A", 1)], [n("d", 4)]]


def test_a_plain_letter_after_an_in_bar_sharp_sounds_the_keys_note_not_the_sharp():
    # The review's trap: [^F, G, F, A] in D minor was written ^F8G8F8A8 and the third note parsed as F# (66).
    bars = [[n("^F", 1), n("G", 1), n("F", 1), n("A", 1)], [n("^f", 1), n("e", 1), n("F", 1), n("A", 1)], *TAIL]
    out, written = applied(CHORDS, 5, bars, ["Dm"] * 4)
    assert written == ["^F8G8=F8A8", "^f8e8=F8A8", "D8E8F8A8", "d32"]
    assert check_edit(CHORDS, out["abc"], [phrase(5, bars)]) == {"ok": True, "problems": [], "differences": []}


def test_a_natural_then_a_plain_letter_in_a_flat_key_gets_the_keys_flat_back():
    bars = [[n("=B", 1), n("B", 1), n("b", 1), n("_B", 1)], [n("A", 1), n("B", 1), n("=b", 1), n("A", 1)], *TAIL]
    _, written = applied(CHORDS, 5, bars, ["Dm"] * 4)
    assert written == ["=B8_B8b8_B8", "A8B8=b8A8", "D8E8F8A8", "d32"]


def test_a_natural_then_a_plain_letter_in_a_sharp_key_gets_the_keys_sharp_back_and_each_bar_starts_clean():
    # 83921775 is F# minor (F#, C#, G#), L:1/16: one beat is 4 units.
    bars = [[n("=F", 1), n("F", 1), n("=c", 1), n("C", 1)], [n("F", 2), n("c", 2)],
            [n("A", 1), n("=G", 1), n("g", 1), n("e", 1)], [n("f", 4)]]
    _, written = applied(SIXTEENTH, 3, bars, ["F#m"] * 4)
    assert written == ["=F4^F4=c4^C4", "F8c8", "A4=G4^g4e4", "f16"]


def test_an_inline_key_in_a_phrase_bar_sets_what_a_plain_letter_means_for_the_rest_of_the_phrase():
    doc = Doc(CHORDS)
    for voice in ("Vocal", "Ins"):
        doc.edit(5, voice).insert(0, ["key", "D"])
    keyed = doc.text()
    bars = [[n("=F", 1), n("F", 1), n("G", 1), n("A", 1)], [n("F", 1), n("=F", 1), n("F", 1), n("A", 1)], *TAIL]
    _, written = applied(keyed, 5, bars, ["D"] * 4)
    assert written == ["[K:D]=F8^F8G8A8", "F8=F8^F8A8", "D8E8F8A8", "d32"]


def test_plain_letters_with_nothing_in_force_stay_plain():
    assert spell_bar([n("D", 1), n("F", 1), n("B", 1), n("c", 1)], "Dm") == [
        n("D", 1), n("F", 1), n("B", 1), n("c", 1)]


def test_a_respelled_note_that_is_tied_carries_its_accidental_on_the_first_piece_only():
    # At L:1/64 a 4-beat note is 48 + 16 tied; the unmarked continuation keeps the tied pitch upstream.
    spelled = spell_bar([n("^F", 1), n("F", 3)], "Dm")
    assert spelled == [n("^F", 1), n("=F", 3)]
    assert [e[1] for e in note_events(n("=F", 4), 64)] == ["=", ""]
