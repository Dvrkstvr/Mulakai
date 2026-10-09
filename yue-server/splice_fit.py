"""The render's two grid fits around a REHARMONIZE span (R-044, single span and
chain alike): the fit on the edited bars before the span and the fit on those
after it. They are fitted apart so that a take that sang the span a bar long
or short shows it (the post offset moves, the 0.25 s length rule renders the
whole song). But a short side is weak evidence: on a tail whose chords repeat
every 4 bars, an offset one loop off matches as well, and `splice_grid.agree`
scores each offset only on the bars it maps inside the grid, so the larger
offset can win on fewer bars (Polski Polka: pre -1, post +3 on a 10-bar loop).

The rule: when the two fits disagree, the render is refitted on every bar
outside the span(s), the same bars the two sides use together. A side keeps
its own offset only if, counted on its bars that both offsets map inside the
grid, it matches at least MIN_LEAD more bars than the whole fit; otherwise it
takes the whole fit. One bar is one chord-tracker miss; a bar inserted or
dropped in the span leaves the side's own offset ahead on most of its bars.

A side with bars but fewer than MIN_LEAD of them to judge on can never lead by
MIN_LEAD, so a real drift there (a 1-bar tail after a span sung a bar long)
would be outvoted unseen and the span cut short (D-285). When such a side
disagrees with the whole fit, side_fits raises ShortSide: the splice renders
the whole song (reason `length`) instead of guessing. A side with no bars has
no join to check and takes the whole fit.
"""
from __future__ import annotations

from splice_grid import Fit, _root, bar_chords, fit, score_bars

MIN_LEAD = 2  # bars


class ShortSide(ValueError):
    """A side too short to judge disagrees with the whole fit; str() is the rerender detail."""


def _matches(f: Fit, intended: list, idx) -> tuple[set, set]:
    """(bars of idx that f maps inside its grid, those whose chord root matches there)."""
    audio = bar_chords(list(f.downbeats), [list(r) for r in f.chords], f.duration)
    inside = {i for i in idx if 0 <= i + f.offset < len(audio) and intended[i] is not None}
    hits = {i for i in inside if (heard := _root(audio[i + f.offset])) is not None and heard == _root(intended[i])}
    return inside, hits


def _side(own: Fit, whole: Fit, intended: list, idx, where: str) -> Fit:
    if (own.offset, own.thinned) == (whole.offset, whole.thinned):
        return own
    inside_own, hits_own = _matches(own, intended, idx)
    inside_whole, hits_whole = _matches(whole, intended, idx)
    both = inside_own & inside_whole
    if idx and len(both) < MIN_LEAD:
        n = len(both)
        raise ShortSide(f"only {n} bar{'' if n == 1 else 's'} {where} the edited bars to check "
                        "the new take's length on")
    return own if len(hits_own & both) - len(hits_whole & both) >= MIN_LEAD else whole


def side_fits(grid: dict, abc: str, pre_idx, post_idx) -> tuple[Fit, Fit]:
    """The render's fits on the edited bars `pre_idx` (before the span) and `post_idx` (after it).
    Raises ShortSide (D-285)."""
    pre_idx, post_idx = list(pre_idx), list(post_idx)
    pre, post = fit(grid, abc, pre_idx), fit(grid, abc, post_idx)
    if (pre.offset, pre.thinned) == (post.offset, post.thinned):
        return pre, post
    whole = fit(grid, abc, pre_idx + post_idx)
    intended = score_bars(abc).chords
    return _side(pre, whole, intended, pre_idx, "before"), _side(post, whole, intended, post_idx, "after")
