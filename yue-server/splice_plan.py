"""REHARMONIZE as SP-4's A3 splice (RESULT "What the real build should copy" 1):
cut at the span's first and last downbeat (each take's grid fitted on its
unedited bars), snap each cut by the onset-pattern lag between the two sides
(corr >= 0.15, cap 80 ms), a 1-beat equal-power crossfade centred on the cut,
and the new take level-matched to the old audio. D-147: the owner heard the
A3 span "a bit louder" where the gain was matched only at the two ends, so the
match is held over the whole span: one anchor per bar (that bar's K-weighted
loudness in the base minus in the new take) between the 3 s end anchors.

A span at bar 1 or at the last bar has one join. The verdict is `rerender`
(the server keeps the whole re-render, D-101) when a grid is unusable, the new
take ends inside the span, or no join has a groove to snap to (D-109).
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np

from splice_dsp import SILENT_LUFS, SR, assemble, gain_ramp, lufs, pattern_lag, seconds

CORR_MIN = 0.15      # pattern correlation below this: no snap, and no groove at that join
SNAP_CAP = 0.08      # never move a cut by more than 80 ms
LEVEL_WINDOW = 3.0   # s of audio matched at each end of the span
MAX_GAIN_DB = 12.0   # a bar's match is clamped here (an outlier bar must not pump the span)


@dataclass
class Splice:
    verdict: str                      # "ok" | "rerender"
    reason: str | None = None         # not_aligned | no_grid | render_truncated | level_step | meter
    detail: str | None = None
    out: np.ndarray | None = None
    parts: list = field(default_factory=list)    # [(source, t0, t1)], source "base" | "render" | "copy"
    widths: list = field(default_factory=list)   # crossfade width per join, s
    joins: list = field(default_factory=list)    # output times of the joins, s
    rows: list = field(default_factory=list)     # assemble's map rows
    base_points: list = field(default_factory=list)  # base time matching each join (None = no counterpart)
    edges: list = field(default_factory=list)    # output windows faded at a song edge, [(t0, t1)]
    facts: dict = field(default_factory=dict)    # snaps, gains, level step ... for the result JSON

    def part_rows(self) -> list[dict]:
        """The map for the result JSON and the null test, in exact sample times."""
        return [{"source": name, "out_s": [round(o0, 7), round(o1, 7)], "src_s": [round(s0, 7), round(s0 + o1 - o0, 7)]}
                for (name, _, _), (o0, o1, _, s0) in zip(self.parts, self.rows)]


def rerender(reason: str, detail: str, **facts) -> Splice:
    return Splice("rerender", reason, detail, facts=facts)


def snap(prev_a, prev_t1, next_a, next_t0, beat, mode):
    """Groove-continuity shift (s) for the adjustable end ('next' moves next_t0, 'prev' moves
    prev_t1), from the lag between the 8 beats before the join and the 8 beats after it."""
    window = 8 * beat
    x1, x2 = seconds(prev_a, prev_t1 - window, prev_t1), seconds(next_a, next_t0, next_t0 + window)
    n = min(len(x1), len(x2))
    lag, corr = pattern_lag(x1[len(x1) - n:], x2[:n]) if n else (0.0, 0.0)
    delta = lag / 1000.0 if mode == "next" else -lag / 1000.0
    applied = corr >= CORR_MIN and abs(delta) <= SNAP_CAP
    return (delta if applied else 0.0), {"delta_ms": round(delta * 1000, 3), "applied": bool(applied),
                                         "corr": round(corr, 4)}


def build(parts, sources: dict, widths, base_points, **facts) -> Splice:
    """Assemble `parts`, dropping empty ones (an edit at a song edge). widths and base_points
    are given per boundary between consecutive parts; a dropped edge part takes its boundary."""
    keep = [t1 - t0 > 1.0 / SR for _, t0, t1 in parts]
    kept = [p for p, k in zip(parts, keep) if k]
    bounds = [b for b in range(len(parts) - 1) if keep[b] and keep[b + 1]]
    widths, points = [widths[b] for b in bounds], [base_points[b] for b in bounds]
    out, joins, rows = assemble([(sources[name], t0, t1) for name, t0, t1 in kept], widths)
    return Splice("ok", out=out, parts=kept, widths=widths, joins=joins, rows=rows,
                  base_points=points, facts=facts)


def _bar_gains(base, new, gb, s, e, tb_s, tb_e, tn_s, tn_e):
    """(new time at the bar's centre, dB) for each bar of the span: base loudness minus new."""
    ratio = (tn_e - tn_s) / (tb_e - tb_s)
    anchors = []
    for i in range(s, e):
        b0, b1 = gb.t(i), gb.t(i + 1)
        n0, n1 = tn_s + (b0 - tb_s) * ratio, tn_s + (b1 - tb_s) * ratio
        lb, ln = lufs(seconds(base, b0, b1)), lufs(seconds(new, n0, n1))
        if b1 - b0 > 0.5 and lb > SILENT_LUFS + 10 and ln > SILENT_LUFS + 10:
            anchors.append(((n0 + n1) / 2, float(np.clip(lb - ln, -MAX_GAIN_DB, MAX_GAIN_DB))))
    return anchors


def splice_reharmonize(base, new, gb, g_pre, g_post, s: int, e: int) -> Splice:
    """Bars [s, e) (0-based) of `base` replaced by the same bars of `new`."""
    beat, n = gb.beat, gb.bars
    first, last = s > 0, e < n
    tb_s = gb.t(s) if first else 0.0  # an edit from bar 1 takes the new take from its start
    tb_e = gb.t(e) if last else len(base) / SR
    tn_s = g_pre.t(s) if first else 0.0
    tn_e = g_post.t(e) if last else len(new) / SR
    if last and e + g_post.offset >= len(g_post.downbeats):
        return rerender("render_truncated", f"the new take ends before bar {e + 1} starts")
    if not (tb_e - tb_s > beat and tn_e - tn_s > beat):
        return rerender("no_grid", "the grid gives the span no length")
    snaps, d1, d2 = [], 0.0, 0.0
    if first:
        d1, row = snap(base, tb_s, new, tn_s, beat, "next")
        snaps.append(row)
    if last:
        d2, row = snap(new, tn_e, base, tb_e, beat, "prev")
        snaps.append(row)
    if snaps and all(row["corr"] < CORR_MIN for row in snaps):
        return rerender("not_aligned", "no groove to line the join up on", snap=snaps)
    tn_s, tn_e = tn_s + d1, tn_e + d2
    anchors = _bar_gains(base, new, gb, s, e, tb_s, tb_e, tn_s, tn_e)
    if anchors:  # the end bars' own match, held flat to the cut
        g_in, g_out = anchors[0][1], anchors[-1][1]
    else:  # SP-4's 3 s windows when no bar could be measured
        g_in = lufs(seconds(base, tb_s, tb_s + LEVEL_WINDOW)) - lufs(seconds(new, tn_s, tn_s + LEVEL_WINDOW))
        g_out = lufs(seconds(base, tb_e - LEVEL_WINDOW, tb_e)) - lufs(seconds(new, tn_e - LEVEL_WINDOW, tn_e))
    ends = ([(tn_s, g_in)] if first else []) + anchors + ([(tn_e, g_out)] if last else [])
    ends = [(t, float(np.clip(g, -MAX_GAIN_DB, MAX_GAIN_DB))) for t, g in sorted(ends)] or [(tn_s, 0.0)]
    leveled = gain_ramp(new, [t for t, _ in ends], [g for _, g in ends])
    parts = [("base", 0.0, tb_s), ("render", tn_s, tn_e), ("base", tb_e, len(base) / SR)]
    gain = {"in": round(g_in, 3) if first else None, "out": round(g_out, 3) if last else None,
            "bars": [round(g, 3) for _, g in anchors]}
    return build(parts, {"base": base, "render": leveled}, [beat, beat], [tb_s, tb_e],
                 snap=snaps, gain_db=gain, span_s={"base": [tb_s, tb_e], "render": [tn_s, tn_e]},
                 offsets={"base": gb.offset, "render_pre": g_pre.offset, "render_post": g_post.offset})
