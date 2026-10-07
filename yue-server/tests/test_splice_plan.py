"""REHARMONIZE splice (A3 + D-147) on synthetic takes: the groove snap, the
level held over the whole span, the null test, one-join edges and the
fallbacks (D-101, D-109)."""
import json

import numpy as np
import pytest

from splice_audio import write_wav
from splice_check import main as check_main, null_test, seams
from splice_dsp import SR, lufs, seconds
from splice_fixtures import groove, grid, score
from splice_grid import fit
from splice_plan import splice_reharmonize

BEAT, BARS, LEAD, BPM = 0.5, 24, 0.25, 120
ABC = score(BARS, BPM)
S, E = 8, 16


def bar_db(contour):
    """A per-bar gain contour (dB) applied to a take, bar i spanning LEAD + i * 2 s."""
    def apply(x):
        y = x.copy()
        for i, db in contour.items():
            a, b = int((LEAD + i * 4 * BEAT) * SR), int((LEAD + (i + 1) * 4 * BEAT) * SR)
            y[a:b] *= np.float32(10 ** (db / 20))
        return y
    return apply


def takes(new_lead=LEAD, grid_lead=LEAD, contour=None, bars_tracked=BARS):
    base = groove(BARS, BEAT, lead=LEAD)
    new = groove(BARS, BEAT, lead=new_lead)
    if contour:
        new = bar_db(contour)(new)
    gb = fit(grid(BARS, BEAT, LEAD, len(base) / SR), ABC)
    g_new = grid(bars_tracked, BEAT, grid_lead, len(new) / SR)
    pre = fit(g_new, ABC, range(0, S))
    post = fit(g_new, ABC, range(E, BARS))
    return base, new, gb, pre, post


def check_null(splice, base):
    return null_test(splice.out, base, splice.part_rows(), splice.widths)


def test_the_new_bars_replace_the_old_and_every_other_base_sample_is_kept():
    base, new, gb, pre, post = takes()
    sp = splice_reharmonize(base, new, gb, pre, post, S, E)
    assert sp.verdict == "ok" and [p[0] for p in sp.parts] == ["base", "render", "base"]
    assert sp.joins == pytest.approx([gb.t(S), gb.t(E)], abs=0.002)
    assert sp.widths == [BEAT, BEAT]
    result = check_null(sp, base)
    assert result["different"] == 0 and result["samples"] > len(base) * 0.6
    assert abs(len(sp.out) - len(base)) / SR < 0.01


def test_a_grid_error_is_snapped_to_the_groove():
    # the new take really starts 30 ms later than its tracker grid says
    base, new, gb, pre, post = takes(new_lead=LEAD + 0.03)
    sp = splice_reharmonize(base, new, gb, pre, post, S, E)
    first, second = sp.facts["snap"]
    assert first["applied"] and first["delta_ms"] == pytest.approx(30.0, abs=1.5)
    assert second["applied"] and second["delta_ms"] == pytest.approx(30.0, abs=1.5)
    assert sp.facts["span_s"]["render"][0] == pytest.approx(gb.t(S) + 0.03, abs=0.002)


def test_the_level_is_matched_over_the_whole_span_not_only_at_its_ends():
    # D-147: the ends match the base but the middle bars are up to 8 dB louder
    contour = {8: 0, 9: 4, 10: 8, 11: 8, 12: 8, 13: 8, 14: 4, 15: 0}
    base, new, gb, pre, post = takes(contour=contour)
    sp = splice_reharmonize(base, new, gb, pre, post, S, E)
    assert sp.facts["gain_db"]["bars"][2:6] == pytest.approx([-8.0] * 4, abs=0.3)
    for i in range(S, E):
        t0, t1 = gb.t(i) + 0.3, gb.t(i + 1) - 0.3
        assert lufs(seconds(sp.out, t0, t1)) == pytest.approx(lufs(seconds(base, t0, t1)), abs=0.6), i
    assert all(abs(s["lufs_step_excess"]) < 0.5 for s in seams(sp.out, sp.joins, base, sp.base_points))


def test_an_edit_from_bar_1_or_to_the_last_bar_has_one_join():
    base, new, gb, _, _ = takes()
    g_new = grid(BARS, BEAT, LEAD, len(new) / SR)
    head = splice_reharmonize(base, new, gb, fit(g_new, ABC, []), fit(g_new, ABC, range(8, BARS)), 0, 8)
    assert head.verdict == "ok" and len(head.joins) == 1 and [p[0] for p in head.parts] == ["render", "base"]
    assert head.facts["gain_db"]["in"] is None and check_null(head, base)["different"] == 0
    tail = splice_reharmonize(base, new, gb, fit(g_new, ABC, range(0, 16)), fit(g_new, ABC, []), 16, BARS)
    assert tail.verdict == "ok" and len(tail.joins) == 1 and [p[0] for p in tail.parts] == ["base", "render"]
    assert tail.facts["gain_db"]["out"] is None and check_null(tail, base)["different"] == 0


def test_no_groove_at_either_join_is_not_aligned():
    rng = np.random.default_rng(5)
    base = (rng.standard_normal((int(50 * SR), 2)) * 0.05).astype(np.float32)
    new = (rng.standard_normal((int(50 * SR), 2)) * 0.05).astype(np.float32)
    g = grid(BARS, BEAT, LEAD, 50.0)
    sp = splice_reharmonize(base, new, fit(g, ABC), fit(g, ABC, range(0, S)), fit(g, ABC, range(E, BARS)), S, E)
    assert (sp.verdict, sp.reason, sp.out) == ("rerender", "not_aligned", None)
    assert all(not row["applied"] for row in sp.facts["snap"])


def test_a_new_take_that_ends_inside_the_span_is_truncated():
    base, new, gb, pre, post = takes(bars_tracked=12)
    sp = splice_reharmonize(base, new, gb, pre, post, S, E)
    assert (sp.verdict, sp.reason) == ("rerender", "render_truncated")


def test_the_cp_c0_check_reads_the_saved_file_and_the_result(tmp_path, capsys):
    base, new, gb, pre, post = takes()
    sp = splice_reharmonize(base, new, gb, pre, post, S, E)
    write_wav(tmp_path / "base.wav", base)
    write_wav(tmp_path / "saved.wav", sp.out)
    result = {"parts": sp.part_rows(), "crossfade_s": sp.widths, "joins_s": sp.joins, "base_points_s": sp.base_points}
    (tmp_path / "result.json").write_text(json.dumps({"result": result}), encoding="utf-8")
    args = [str(tmp_path / name) for name in ("base.wav", "saved.wav", "result.json")]
    assert check_main(args) == 0
    report = json.loads(capsys.readouterr().out)
    assert report["null_test"]["different"] == 0 and len(report["seams"]) == 2
    tampered = sp.out.copy()
    tampered[SR] += 0.01
    write_wav(tmp_path / "saved.wav", tampered)
    assert check_main(args) == 1


def short_span_take(drop: float):
    """R-033 (SP-6): a new take that plays the edited bars faster, so its span runs `drop` s
    short of the base's; the bars around it are the base's own, every later one `drop` s earlier."""
    base = groove(BARS, BEAT, lead=LEAD)
    t_s, t_e = (int(round((LEAD + b * 4 * BEAT) * SR)) for b in (S, E))
    fast = (E - S) * 4 * BEAT - drop
    span = groove(E - S, fast / ((E - S) * 4), tail=0.0)[:int(round(fast * SR))]
    new = np.concatenate([base[:t_s], span, base[t_e:]])
    g_new = grid(BARS, BEAT, LEAD, len(new) / SR)
    d = [round(t if i <= S else LEAD + S * 4 * BEAT + (i - S) * fast / (E - S) if i <= E else t - drop, 4)
         for i, t in enumerate(g_new["downbeats"])]
    g_new["downbeats"] = d
    g_new["chords"] = [[t, d[i + 1] if i + 1 < BARS else len(new) / SR, row[2]] for i, (t, row) in enumerate(zip(d, g_new["chords"]))]
    gb = fit(grid(BARS, BEAT, LEAD, len(base) / SR), ABC)
    return base, new, gb, fit(g_new, ABC, range(0, S)), fit(g_new, ABC, range(E, BARS))


def test_a_new_span_that_runs_short_is_not_spliced_but_rerendered():
    # SP-6: verdict ok with the song 1.9-7.6 s short; F-047 allows under 0.25 s
    base, new, gb, pre, post = short_span_take(2.0)
    sp = splice_reharmonize(base, new, gb, pre, post, S, E)
    assert (sp.verdict, sp.reason, sp.out) == ("rerender", "length", None)
    diff = sp.facts["length_diff_s"]
    assert diff == pytest.approx(-2.0, abs=2 * 0.08)  # each join's snap moves a cut by at most 80 ms
    assert f"bars 9-16 run {-diff:.2f} s shorter" in sp.detail


def test_a_span_within_a_quarter_second_of_the_base_is_still_spliced():
    base, new, gb, pre, post = short_span_take(0.2)
    sp = splice_reharmonize(base, new, gb, pre, post, S, E)
    assert sp.verdict == "ok"
    assert -0.25 < (len(sp.out) - len(base)) / SR < -0.1
    assert check_null(sp, base)["different"] == 0
