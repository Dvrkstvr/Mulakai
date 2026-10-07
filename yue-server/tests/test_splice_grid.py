"""splice_grid on SP-4's recorded SheetSage2 rows (tests/data/splice/<take>/: the
base version `X_orig` and the REHARMONIZE re-render `X_b` of songs A-D, with the
scores they were fitted to). The fitted offsets, root agreement and the span's
bar times must equal SP-4's (results/splice_<song>.json, reharm_A3)."""
from pathlib import Path

import pytest

from splice_fixtures import grid as synthetic_grid, score as synthetic_score
from splice_grid import GridError, fit, read_grid, score_bars, validate_grid

DATA = Path(__file__).parent / "data" / "splice"

# song: (0-based span [s, e) of the first chorus, base root agreement, base span s, new span s)
SP4 = {
    "A": ((46, 54), 1.0, (124.33, 146.37), (124.30, 146.37)),
    "B": ((22, 30), 0.9672131147540983, (53.26, 73.71), (53.31, 73.94)),
    "C": ((14, 22), 1.0, (37.16, 59.75), (37.06, 59.65)),
    "D": ((22, 30), 1.0, (55.51, 75.71), (55.69, 75.90)),
}


def take(name):
    return read_grid(DATA / name), (DATA / name / "score.abc").read_text(encoding="utf-8")


@pytest.mark.parametrize("song", sorted(SP4))
def test_the_base_grid_fits_as_sp4_fitted_it(song):
    (s, e), root, base_span, _ = SP4[song]
    g, abc = take(f"{song}_orig")
    f = fit(g, abc)
    assert (f.offset, f.thinned) == (0, False)
    assert f.root == pytest.approx(root)
    assert (f.t(s), f.t(e)) == pytest.approx(base_span)


@pytest.mark.parametrize("song", sorted(SP4))
def test_the_new_take_fits_on_the_unedited_bars_only(song):
    (s, e), _, _, new_span = SP4[song]
    g, abc = take(f"{song}_b")
    n = len(score_bars(abc).chords)
    pre, post = fit(g, abc, range(0, s)), fit(g, abc, range(e, n))
    assert (pre.offset, post.offset) == (0, 0)
    assert (pre.t(s), post.t(e)) == pytest.approx(new_span)


def test_the_end_of_the_song_is_the_tracked_duration():
    g, abc = take("A_orig")
    f = fit(g, abc)
    assert f.t(f.bars) == pytest.approx(176.59866666666667)
    assert f.beat == pytest.approx(60 / 87)


def test_a_grid_tracked_at_half_bars_is_thinned():
    doubled = synthetic_grid(32, 0.5 / 2)  # downbeats every 2 beats of a 120 BPM song
    doubled["chords"] = [[t0, t1, ["C:maj", "A:min", "F:maj", "G:maj"][(i // 2) % 4]]
                         for i, (t0, t1, _) in enumerate(doubled["chords"])]
    f = fit(doubled, synthetic_score(16, 120))
    assert f.thinned and f.offset == 0
    assert f.t(1) - f.t(0) == pytest.approx(2.0)


def test_score_bars_reads_chords_and_meters():
    bars = score_bars(synthetic_score(8, 100, meter="3/4"))
    assert bars.chords[:4] == ["C", "Am", "F", "G"] and bars.bpm == 100
    assert bars.four_four is False
    assert score_bars((DATA / "B_orig" / "score.abc").read_text(encoding="utf-8")).four_four is False
    assert score_bars((DATA / "A_orig" / "score.abc").read_text(encoding="utf-8")).four_four is True


def test_a_sidecar_grid_is_checked():
    good = synthetic_grid(8, 0.5)
    assert validate_grid(good) == good
    for bad in ({**good, "grid_v": 2}, {**good, "downbeats": [2.0, 1.0]}, {"grid_v": 1}):
        with pytest.raises(GridError):
            validate_grid(bad)
