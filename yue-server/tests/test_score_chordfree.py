"""F-065 (D-132): a chord-free score (a cover's transcription, melody only) is
score-editable. REHARMONIZE writes chords into its range and the edit passes
the checker; SET_TEMPO and TRANSPOSE leave it chord-free (the render then uses
cot melody, the server's renderMode)."""
from __future__ import annotations

from score_check import check_edit, verdict
from score_fixtures import CHORDS, STYLE
from score_ops import apply_ops
from scores import strip_chords

FREE = strip_chords(CHORDS)
REHARM = {"op": "REHARMONIZE", "from_bar": 47, "to_bar": 50, "chords": [
    {"bar": b, "beat": 1, "root": r, "quality": q}
    for b, r, q in [(47, "D", "m7"), (48, "G", "7"), (49, "Bb", "maj7"), (50, "A", "7sus4")]]}


def test_the_fixture_is_a_valid_chord_free_score():
    read = verdict(FREE)
    assert read["ok"] and read["chords_present"] is False


def test_reharmonize_writes_chords_into_a_chord_free_score_and_passes_the_checker():
    out = apply_ops(FREE, STYLE, [REHARM])
    assert out["verdicts"] == [{"index": 1, "op": "REHARMONIZE", "ok": True, "reason": None}]
    after = verdict(out["abc"])
    assert after["ok"] and after["chords_present"] is True
    assert '"Dm7"' in out["abc"] and '"A7sus4"' in out["abc"]
    assert check_edit(FREE, out["abc"], [REHARM]) == {"ok": True, "problems": [], "differences": []}


def test_set_tempo_and_transpose_keep_a_chord_free_score_chord_free():
    ops = [{"op": "SET_TEMPO", "bpm": 96}, {"op": "TRANSPOSE", "semitones": 2}]
    out = apply_ops(FREE, STYLE, ops)
    assert all(v["ok"] for v in out["verdicts"])
    assert verdict(out["abc"])["chords_present"] is False
    assert check_edit(FREE, out["abc"], ops)["ok"]
