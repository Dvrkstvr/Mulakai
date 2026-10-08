"""REPEAT and CUT on the base audio alone (SP-4's candidate C, D-154): REPEAT is
spliced only under the level-step threshold derived from SP-4's measured rows;
CUT moves its join into a gap in the voice band, the fix for the owner's "small
hitch right at the cut spot" (p18)."""
import numpy as np
import pytest

from splice_check import null_test
from splice_dsp import SR
from splice_fixtures import groove, grid, score
from splice_grid import fit
from splice_sections import REPEAT_MAX_STEP_DB, repeat_verdict, splice_cut, splice_repeat

BEAT, BARS, LEAD = 0.5, 24, 0.25
ABC = score(BARS, 120)

# SP-4 results/splice_<song>.json, repeat_C1: the literal 3 s LUFS step at the copy's seam,
# and what the owner heard (listen/answers-part2.json p13, p15; B and D were not in the listen).
SP4_REPEAT_STEPS = {"A": (8.481, "rerender"), "B": (-0.061, "ok"), "C": (3.522, "ok"), "D": (-0.26, "ok")}


@pytest.mark.parametrize("song", sorted(SP4_REPEAT_STEPS))
def test_the_repeat_threshold_splits_sp4s_rows_as_the_owner_heard_them(song):
    step, verdict = SP4_REPEAT_STEPS[song]
    assert repeat_verdict(step)[0] == verdict


def test_the_threshold_sits_between_the_step_heard_fine_and_the_one_heard():
    assert 3.522 < REPEAT_MAX_STEP_DB < 8.481
    assert repeat_verdict(-REPEAT_MAX_STEP_DB - 0.1)[0] == "rerender"


def song(pad_db=None, words=()):
    base = groove(BARS, BEAT, lead=LEAD, pad_db=pad_db, words=words)
    return base, fit(grid(BARS, BEAT, LEAD, len(base) / SR), ABC)


def test_repeat_inserts_the_section_after_itself_and_keeps_the_base():
    base, gb = song()
    sp = splice_repeat(base, gb, 8, 16)
    assert sp.verdict == "ok" and [p[0] for p in sp.parts] == ["base", "copy", "base"]
    assert len(sp.out) - len(base) == pytest.approx((gb.t(16) - gb.t(8)) * SR, abs=0.1 * SR)
    # the copy ends where the section ended, so the second join is a plain continuation
    assert sp.widths == [BEAT, 0.0]
    assert null_test(sp.out, base, sp.part_rows(), sp.widths)["different"] == 0
    assert abs(sp.facts["level_step_db"]) < 1.0


@pytest.mark.parametrize("tail", [1.0, 3.0, 6.0])
def test_repeating_the_last_section_seams_at_its_last_bar_not_after_the_ring_out(tail):
    # C1 N1: an outro's end is the end of the audio; the seam must sit where its last bar
    # ends (the tracker has no downbeat after it), and the ring-out plays once, at the very end
    base = groove(BARS, BEAT, lead=LEAD, tail=tail)
    gb = fit(grid(BARS, BEAT, LEAD, len(base) / SR), ABC)
    sp = splice_repeat(base, gb, 16, BARS)
    assert (sp.verdict, sp.reason) == ("ok", None)
    bar_end = LEAD + BARS * 4 * BEAT
    assert sp.joins[0] == pytest.approx(bar_end, abs=0.002)
    assert sp.parts[-1] == ("base", pytest.approx(bar_end), pytest.approx(len(base) / SR))
    assert len(sp.out) - len(base) == pytest.approx(8 * 4 * BEAT * SR, abs=0.01 * SR)
    assert sp.facts["snap"][0]["corr"] > 0.9 and abs(sp.facts["level_step_db"]) < 1.0
    assert null_test(sp.out, base, sp.part_rows(), sp.widths)["different"] == 0


def test_a_repeat_whose_seam_steps_too_far_says_rerender():
    # the section ends quiet and starts loud: the copy's seam jumps far over the threshold
    loud = lambda i: -6.0 if i == 8 else -40.0  # noqa: E731
    base, gb = song(pad_db=loud)
    base[int(gb.t(8) * SR):int(gb.t(9) * SR)] *= 4
    sp = splice_repeat(base, gb, 8, 16)
    assert (sp.verdict, sp.reason, sp.out) == ("rerender", "level_step", None)
    assert sp.facts["level_step_db"] > REPEAT_MAX_STEP_DB


def test_a_cut_removes_the_section_and_keeps_the_base():
    base, gb = song()
    sp = splice_cut(base, gb, 8, 12)
    assert sp.verdict == "ok" and [p[0] for p in sp.parts] == ["base", "base"]
    assert (len(base) - len(sp.out)) / SR == pytest.approx(gb.t(12) - gb.t(8), abs=0.1)
    assert sp.facts["gap_shift_s"] == 0.0 and sp.widths == [BEAT]
    assert null_test(sp.out, base, sp.part_rows(), sp.widths)["different"] == 0


def pickup_words(gb, at_bars):
    """A sung pickup into each bar: a word from 0.3 s before the downbeat to 0.4 s after,
    with the voice band quiet for 0.4 s before it."""
    return [(gb.t(i) - 0.3, gb.t(i) + 0.4) for i in at_bars]


def test_a_cut_moves_into_the_gap_before_the_pickup_words():
    _, gb = song()
    base, _ = song(words=pickup_words(gb, [8, 12]))
    sp = splice_cut(base, gb, 8, 12)
    shift = sp.facts["gap_shift_s"]
    assert -0.75 < shift < -0.3  # before both pickups, inside their gap
    assert sp.widths == [BEAT / 4]
    assert sp.joins[0] == pytest.approx(gb.t(8) + shift, abs=0.002)
    assert null_test(sp.out, base, sp.part_rows(), sp.widths)["different"] == 0


def test_a_cut_with_no_shared_gap_stays_on_the_downbeat():
    _, gb = song()
    words = [(gb.t(8) - 1.4, gb.t(8) + 0.6), (gb.t(12) - 0.3, gb.t(12) + 0.4)]
    base, _ = song(words=words)
    sp = splice_cut(base, gb, 8, 12)
    assert sp.facts["gap_shift_s"] == 0.0 and sp.widths == [BEAT]


def test_cutting_the_first_or_last_section_fades_the_song_edge():
    base, gb = song()
    head = splice_cut(base, gb, 0, 4)
    assert head.verdict == "ok" and head.joins == [] and len(head.edges) == 1
    assert head.out[0].max() == 0.0 and null_test(head.out, base, head.part_rows(), head.widths, head.edges)["different"] == 0
    tail = splice_cut(base, gb, 20, BARS)
    assert tail.verdict == "ok" and tail.joins == [] and abs(tail.out[-1]).max() < 1e-3
    assert null_test(tail.out, base, tail.part_rows(), tail.widths, tail.edges)["different"] == 0


def test_no_groove_at_the_seam_is_not_aligned():
    rng = np.random.default_rng(9)
    base = (rng.standard_normal((int(49.25 * SR), 2)) * 0.05).astype(np.float32)
    gb = fit(grid(BARS, BEAT, LEAD, 49.25), ABC)
    assert splice_cut(base, gb, 8, 12).reason == "not_aligned"
    assert splice_repeat(base, gb, 8, 12).reason == "not_aligned"
