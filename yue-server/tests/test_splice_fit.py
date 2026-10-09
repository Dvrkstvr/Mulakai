"""The render's fits before and after a REHARMONIZE span (R-044): a short tail
whose chords loop every 4 bars must not let the post fit pick an offset one
loop off (it read the span 4 bars long and forced a whole-song render, Polski
Polka in CP-C4); a bar the take really added inside the span must still move
the post fit, so the length rule renders the whole song."""
import pytest

import splice_harness
from conftest import wait_for
from splice_dsp import SR
from splice_fit import ShortSide, side_fits
from splice_fixtures import CHORDS, grid, score, wav_bytes
from splice_grid import fit
from splice_harness import BARS, BASE_ABC, BEAT, LEAD, NEW, done, splice, splicer, tracker  # noqa: F401

SPAN = range(12, 16)  # 0-based; the edited bars; the 8 bars after it are the tail
MISHEARD = {16, 17, 23}  # tail bars the tracker hears as another chord on the render


def edited_chord(i: int) -> str:
    return "Dm" if i in SPAN else CHORDS[i % 4][0]


def looped_render_grid(bars: int = BARS, span=SPAN, misheard=MISHEARD) -> dict:
    """The render's grid: the edited chords, except a few tail bars heard as E."""
    def label(i):
        return "E:maj" if i in misheard else "D:min" if i in span else CHORDS[i % 4][1]
    return grid(bars, BEAT, LEAD, len(NEW) / SR, chord_of=label)


def test_a_looped_tail_takes_the_fit_on_every_bar_outside_the_span():
    abc = score(BARS, 120, chord_of=edited_chord)
    g = looped_render_grid()
    pre, post = range(0, 12), range(16, BARS)
    assert fit(g, abc, post).offset == 4  # the tail alone: one loop off, on 4 bars instead of 8
    g_pre, g_post = side_fits(g, abc, pre, post)
    assert (g_pre.offset, g_post.offset) == (0, 0)
    assert g_post.t(16) - g_pre.t(12) == pytest.approx(4 * 4 * BEAT)


def test_a_bar_the_take_added_in_the_span_still_moves_the_post_fit():
    abc = score(BARS, 120, chord_of=edited_chord)
    labels = [CHORDS[i % 4][1] for i in range(12)] + ["D:min"] * 5 + [CHORDS[i % 4][1] for i in range(16, BARS)]
    g = grid(BARS + 1, BEAT, LEAD, chord_of=lambda j: labels[j])
    g_pre, g_post = side_fits(g, abc, range(0, 12), range(16, BARS))
    assert (g_pre.offset, g_post.offset) == (0, 1)


def test_a_side_with_no_bars_takes_the_whole_fit():
    abc = score(BARS, 120, chord_of=edited_chord)
    g_pre, g_post = side_fits(looped_render_grid(), abc, range(0, 12), [])
    assert (g_pre.offset, g_post.offset) == (0, 0)


def render(monkeypatch, client, tracker, abc: str, g: dict) -> str:
    tracker.add(wav_bytes(NEW), g)
    monkeypatch.setattr(splice_harness, "NEW", NEW)
    job = client.post("/v1/jobs", json={"style": "pop", "lyrics": "", "seed": 1, "abc": abc}).json()
    wait_for(lambda: client.get(f"/v1/jobs/{job['id']}").json()["status"] == "succeeded")
    return job["id"]


def reharm(first: int, last: int) -> dict:
    return {"op": "REHARMONIZE", "from_bar": first, "to_bar": last, "chords": []}


def test_a_reharmonize_before_a_looped_tail_splices(splicer, tracker, monkeypatch):
    client = splicer(tracker)
    abc = score(BARS, 120, chord_of=edited_chord, sections=splice_harness.SECTIONS)
    job = render(monkeypatch, client, tracker, abc, looped_render_grid())
    spec = {"op": reharm(13, 16), "base_abc": BASE_ABC, "render_job": job, "edited_abc": abc}
    result = done(client, splice(client, spec).json()["id"])["result"]
    assert (result["verdict"], result.get("reason")) == ("ok", None)
    assert abs(result["length_diff_s"]) < 0.05


def test_a_chained_reharmonize_before_a_looped_tail_splices(splicer, tracker, monkeypatch):
    client = splicer(tracker)
    # CUT the first verse (bars 1-8): the edited score is base bars 9-24, the span is its bars 5-8
    span = range(4, 8)
    abc = score(16, 120, chord_of=lambda i: "Dm" if i in span else CHORDS[i % 4][0],
                sections=[("chorus", 0), ("verse", 8)])
    job = render(monkeypatch, client, tracker, abc, looped_render_grid(16, span, {8, 9, 15}))
    steps = [{"op": reharm(13, 16)}, {"op": {"op": "CUT", "section": 1, "label": "verse"}}]
    spec = {"steps": steps, "base_abc": BASE_ABC, "render_job": job, "edited_abc": abc}
    result = done(client, splice(client, spec).json()["id"])["result"]
    assert (result["verdict"], result.get("reason"), result["step"]) == ("ok", None, None)
    assert [r["verdict"] for r in result["steps"]] == ["ok", "ok"]


# D-278: the reviewer's case. A span that leaves one bar after it, and a take that sang the span
# a bar long: the 1-bar tail cannot outvote the whole fit, so it must not adopt it either.
LONG_SPAN = range(12, BARS - 1)  # 0-based; bars 13..23 of 24, the tail is bar 24 alone


def long_take_grid(bars: int = BARS, span=LONG_SPAN) -> dict:
    """The render's grid: the edited chords with the span sung one bar long."""
    labels = [CHORDS[i % 4][1] for i in range(span.start)] + ["D:min"] * (len(span) + 1) \
        + [CHORDS[i % 4][1] for i in range(span.stop, bars)]
    return grid(bars + 1, BEAT, LEAD, chord_of=lambda j: labels[j])


def long_score(bars: int = BARS, span=LONG_SPAN, **kw) -> str:
    return score(bars, 120, chord_of=lambda i: "Dm" if i in span else CHORDS[i % 4][0], **kw)


def test_a_one_bar_tail_that_disagrees_cannot_be_judged():
    abc, g = long_score(), long_take_grid()
    assert fit(g, abc, [BARS - 1]).offset == 1  # the tail alone sees the bar the take added
    with pytest.raises(ShortSide, match="1 bar after"):
        side_fits(g, abc, range(0, 12), [BARS - 1])


def test_a_reharmonize_with_a_one_bar_tail_sung_long_renders_the_whole_song(splicer, tracker, monkeypatch):
    client = splicer(tracker)
    abc = long_score(sections=splice_harness.SECTIONS)
    job = render(monkeypatch, client, tracker, abc, long_take_grid())
    spec = {"op": reharm(13, BARS - 1), "base_abc": BASE_ABC, "render_job": job, "edited_abc": abc}
    result = done(client, splice(client, spec).json()["id"])["result"]
    assert (result["verdict"], result["reason"]) == ("rerender", "length")
    assert "1 bar after" in result["detail"]


def test_a_chained_reharmonize_with_a_one_bar_tail_sung_long_renders_the_whole_song(splicer, tracker, monkeypatch):
    client = splicer(tracker)
    span = range(4, 15)  # CUT bars 1-8: the edited score is base bars 9-24, the span is its bars 5-15
    abc = long_score(16, span, sections=[("chorus", 0), ("verse", 8)])
    job = render(monkeypatch, client, tracker, abc, long_take_grid(16, span))
    steps = [{"op": reharm(13, BARS - 1)}, {"op": {"op": "CUT", "section": 1, "label": "verse"}}]
    spec = {"steps": steps, "base_abc": BASE_ABC, "render_job": job, "edited_abc": abc}
    result = done(client, splice(client, spec).json()["id"])["result"]
    assert (result["verdict"], result["reason"], result["step"]) == ("rerender", "length", 1)
