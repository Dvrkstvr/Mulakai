import pytest

from retime_beats import BeatError, double, half, read_bpm, read_rows, regular, transform, write_rows


def grid(beats, step=0.5, start=0.0, num=4, stub=False):
    """`beats` 4/4 beats from `start`, beat 1 first; with `stub`, a leading 1/8 pickup row."""
    rows = [[start + i * step, i % num + 1, num, 4] for i in range(beats)]
    return ([[start - step / 2, 1, 1, 8]] if stub else []) + rows


def test_rows_round_trip_through_the_saved_text():
    rows = grid(5)
    assert read_rows(write_rows(rows)) == rows
    with pytest.raises(BeatError):
        read_rows("0.0\t1\t4\n")
    with pytest.raises(BeatError):
        read_rows("0.0\t1\t4\t4\n")


def test_read_bpm_is_the_median_gap():
    assert read_bpm(grid(9, step=0.5)) == pytest.approx(120)
    jitter = grid(9, step=0.5)
    jitter[3][0] += 0.2  # one late beat does not move the median
    assert read_bpm(jitter) == pytest.approx(120)


def test_half_keeps_every_other_beat_from_the_first_downbeat():
    rows = grid(33)
    out = half(rows)
    assert [r[0] for r in out] == [r[0] for r in rows[::2]]
    assert [r[1] for r in out[:5]] == [1, 2, 3, 4, 1]
    assert read_bpm(out) == pytest.approx(60)


def test_half_keeps_a_pickup_in_phase_with_the_downbeat():
    rows = [[0.0, 3, 4, 4], [0.5, 4, 4, 4]] + [[1.0 + i * 0.5, i % 4 + 1, 4, 4] for i in range(16)]
    out = half(rows)
    assert out[0][0] == 0.0 and 1.0 in [r[0] for r in out]  # the downbeat at 1.0 stays a beat
    assert 0.5 not in [r[0] for r in out]


def test_a_pickup_stub_in_another_meter_is_left_alone():
    rows = grid(17, stub=True)
    assert half(rows)[0] == [rows[0][0], 1, 1, 8]
    doubled = double(rows)
    assert doubled[0] == [rows[0][0], 1, 1, 8] and doubled[1][0] == rows[1][0]  # no midpoint after the stub
    assert all(r[2:] == [4, 4] for r in doubled[1:])


def test_double_adds_midpoints_and_doubles_the_tempo():
    rows = grid(9)
    out = double(rows)
    assert len(out) == 17 and out[1][0] == pytest.approx(0.25)
    assert read_bpm(out) == pytest.approx(240)
    assert [r[1] for r in out[:6]] == [1, 2, 3, 4, 1, 2]


def test_regular_lays_a_grid_from_the_first_downbeat():
    rows = [[0.2, 4, 4, 4]] + grid(17, step=0.5, start=0.7)  # a one-beat pickup, then 120 BPM
    out = regular(rows, 80)
    assert out[0] == [0.2, 1, 4, 4]  # the pickup is kept
    assert out[1][:2] == [0.7, 1]
    assert read_bpm(out[1:]) == pytest.approx(80)
    assert out[-1][0] == pytest.approx(rows[-1][0], abs=0.75 * 60 / 80)


def test_transform_names_the_mode():
    rows = grid(9)
    assert transform(rows, "half") == half(rows)
    assert transform(rows, "bpm", 90) == regular(rows, 90)
    with pytest.raises(BeatError):
        transform(rows, "bpm")
    with pytest.raises(BeatError):
        transform(rows, "triple")
