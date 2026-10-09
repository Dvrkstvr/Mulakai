"""The chained splice's pure parts (F-069, D-263/D-264): the step list's checks,
each REHARMONIZE span mapped from base bars to the edited score's bars across
the CUT/REPEAT sections before it, the bars the render's grid is fitted on, and
the composed part map that null-tests a saved file against the original base."""
import numpy as np
import pytest

from splice_chain import ChainError, fit_bars, map_spans, validate
from splice_check import compose, final_joins, null_test_map
from splice_dsp import SR
from splice_harness import splice, splicer  # noqa: F401
from test_splice_job import chain, reharm, sec


def step(op: str, s: int, e: int) -> dict:
    return {"op": {"op": op}, "span": [s, e]}


@pytest.mark.parametrize("steps, says", [
    ([step("CUT", 8, 16)], "2-4 steps"),
    ([step("REHARMONIZE", 40, 44), step("REHARMONIZE", 30, 34), step("CUT", 20, 24),
      step("CUT", 10, 14), step("CUT", 0, 4)], "2-4 steps"),
    ([step("CUT", 0, 8), step("REHARMONIZE", 16, 20)], "last bar first"),
    ([step("REHARMONIZE", 16, 20), step("CUT", 8, 17)], "overlap"),
    ([step("REHARMONIZE", 16, 20), step("REHARMONIZE", 16, 18)], "last bar first"),
])
def test_a_bad_step_list_is_refused(steps, says):
    with pytest.raises(ChainError, match=says):
        validate(steps)


def test_steps_that_touch_but_do_not_overlap_pass():
    validate([step("REHARMONIZE", 16, 20), step("CUT", 8, 16)])  # the planner keeps gaps; yue checks order only


def test_a_reharmonize_after_a_cut_moves_back_by_the_cut_section():
    steps = [step("REHARMONIZE", 18, 22), step("CUT", 8, 16)]
    assert map_spans(steps, 24, 16) == [(10, 14), None]


def test_a_reharmonize_before_a_cut_stays_where_it_is():
    steps = [step("CUT", 16, 24), step("REHARMONIZE", 2, 6)]
    assert map_spans(steps, 24, 16) == [None, (2, 6)]


def test_a_reharmonize_between_a_repeat_and_a_cut():
    steps = [step("CUT", 28, 32), step("REHARMONIZE", 18, 22), step("REPEAT", 0, 8)]
    assert map_spans(steps, 32, 36) == [None, (26, 30), None]


def test_two_reharmonize_spans_after_both_section_ops():
    steps = [step("REHARMONIZE", 30, 32), step("REHARMONIZE", 20, 24), step("REPEAT", 8, 12), step("CUT", 0, 4)]
    assert map_spans(steps, 32, 32) == [(30, 32), (20, 24), None, None]


def test_an_edited_score_of_another_length_is_not_mapped():
    with pytest.raises(ChainError, match="bars"):
        map_spans([step("REHARMONIZE", 18, 22), step("CUT", 8, 16)], 24, 24)


def test_the_render_grid_is_fitted_on_bars_outside_every_mapped_span():
    mapped = [(20, 24), None, (4, 8)]
    pre, post = fit_bars(mapped, 0, 30)
    assert pre == [b for b in range(20) if not 4 <= b < 8] and post == list(range(24, 30))
    pre, post = fit_bars(mapped, 2, 30)
    assert pre == [0, 1, 2, 3] and post == [b for b in range(8, 30) if not 20 <= b < 24]


def part(source, o0, o1, s0):
    return {"source": source, "out_s": [o0, o1], "src_s": [s0, s0 + o1 - o0]}


def test_the_composed_map_traces_every_kept_sample_back_to_the_base():
    # step 1 cuts base 20-30 s (join at 20, crossfade 0); step 2 repeats base 2-4 s after 4 s
    rows = [{"parts": [part("base", 0, 20, 0), part("base", 20, 50, 30)], "crossfade_s": [0.0], "edges": []},
            {"parts": [part("base", 0, 4, 0), part("copy", 4, 6, 2), part("base", 6, 52, 4)],
             "crossfade_s": [0.0, 0.0], "edges": []}]
    segs = compose(rows)
    rng = np.random.default_rng(3)
    base = rng.standard_normal((60 * SR, 2)).astype(np.float32)
    out = np.concatenate([base[:4 * SR], base[2 * SR:4 * SR], base[4 * SR:20 * SR], base[30 * SR:]])
    check = null_test_map(out, base, segs)
    assert check["different"] == 0 and check["samples"] > 45 * SR
    out[30 * SR] += 0.5  # base 34 s, kept by both steps
    assert null_test_map(out, base, segs)["different"] == 1
    rows = [{**r, "joins_s": j, "base_points_s": [None] * len(j)} for r, j in zip(rows, ([20.0], [4.0, 6.0]))]
    joins = final_joins(rows)
    assert [round(t, 3) for t, _ in joins] == [22.0, 4.0, 6.0]  # step 1's join moved 2 s later by step 2


@pytest.mark.parametrize("spec, says", [
    ({**chain([sec("CUT", 3, "verse"), sec("CUT", 1, "verse")]), "op": {"op": "CUT"}}, "never both"),
    (chain([sec("CUT", 3, "verse")]), "2-4 steps"),
    (chain([sec("CUT", 1, "verse"), sec("CUT", 3, "verse")]), "last bar first"),
    (chain([reharm(15, 20), sec("CUT", 2, "chorus")]), "overlap"),
    (chain([reharm(19, 22), sec("CUT", 2, "chorus")]), "render_job"),
    (chain([{"op": {"op": "WRITE_PHRASE"}}, sec("CUT", 1, "verse")]), "renders the whole song"),
    (chain([sec("CUT", 3, "verse"), sec("CUT", 2, "verse")]), "step 2: section 2 is chorus"),
    ({**chain([]), "steps": "CUT"}, "list"),
])
def test_a_bad_chain_is_refused_before_it_is_queued(splicer, spec, says):
    reply = splice(splicer(), spec)
    assert reply.status_code == 422 and says in reply.json()["detail"]
