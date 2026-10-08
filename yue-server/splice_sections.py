"""REPEAT and CUT on the base audio alone, no YuE2 render (SP-4's candidate C,
D-150/D-154): the section's bars are copied or removed with the same cut logic
as the REHARMONIZE splice (downbeat cut, groove snap, equal-power crossfade).

REPEAT is spliced only while the copy's seam steps less than
REPEAT_MAX_STEP_DB in short-term loudness (3 s either side, as SP-4 measured
it). SP-4's four rows: +8.5 dB (song A; the owner: "cross fade is very
obvious"), +3.5 dB (song C; "barely noticeable, sounds really good"), -0.1 and
-0.3 dB (B, D; not in the listen). 4 dB passes everything heard as fine and
nothing louder; above it the job says `rerender` (the score REPEAT, M2).

CUT, the fix for the owner's "small hitch right at the cut spot" (p18): a cut
at the downbeat lands inside sung words (SP-4: song B kept the cut verse's
pickup "Yo" and lost the next section's "Y di-"). Both cut points move by the
same shift (so the snapped groove still lines up), within 2 beats before to
half a beat after the downbeat, to where the voice band (300-3400 Hz) is
quietest on both sides; when that is at least GAP_MIN_DIP_DB quieter than the
downbeat, the crossfade narrows to a quarter beat so neither side's next word
leaks in. On SP-4's real CUT seams (base audio, recorded grids): A -1.12 s
(12 dB quieter; Whisper finds no word at either cut), B -0.70 s (7 dB; before
"Yo" and before "Y dime"), C -0.12 s (14 dB), D stays on the downbeat (2 dB,
a dense "dime, dime" line).
"""
from __future__ import annotations

import numpy as np

from splice_check import step
from splice_dsp import SR, band_level
from splice_plan import CORR_MIN, build, rerender, snap

REPEAT_MAX_STEP_DB = 4.0
GAP_MIN_DIP_DB = 6.0
GAP_RANGE_BEATS = (-2.0, 0.5)
GAP_PENALTY_DB_PER_BEAT = 0.5  # of two equally quiet gaps, the nearer one


def repeat_verdict(step_db: float) -> tuple[str, str | None]:
    if abs(step_db) > REPEAT_MAX_STEP_DB:
        return "rerender", (f"the copy's seam steps {step_db:+.1f} dB in loudness "
                            f"(more than {REPEAT_MAX_STEP_DB:.0f} dB): the whole song is re-rendered")
    return "ok", None


def section_end(gb, e: int) -> float:
    """Where bar e starts. The grid's time for the bar after the song is the end of the audio,
    the outro's ring-out, not a downbeat (C1 N1: a seam there has no groove to snap to), so
    with no downbeat for bar e the last bar's end is its downbeat plus the bar before it."""
    j = e + gb.offset
    if 0 <= j < len(gb.downbeats):
        return gb.downbeats[j]
    last, before = gb.t(e - 1), gb.t(e - 2) if e >= 2 else None
    bar = last - before if before is not None and 0 < last - before else 4 * gb.beat
    return min(last + bar, gb.duration) if last < gb.duration else gb.duration


def splice_repeat(base, gb, s: int, e: int):
    """Bars [s, e) (0-based) played again right after themselves; after the last section the
    song's ring-out plays once, at the end."""
    beat, end = gb.beat, len(base) / SR
    tb_s, tb_e = gb.t(s), min(section_end(gb, e), len(base) / SR)
    shift, row = snap(base, tb_e, base, tb_s, beat, "next")
    if row["corr"] < CORR_MIN:
        return rerender("not_aligned", "no groove to line the copy's seam up on", snap=[row])
    # The copy ends where the section ended, so the music after it simply continues: no crossfade.
    sp = build([("base", 0.0, tb_e), ("copy", tb_s + shift, tb_e), ("base", tb_e, end)],
               {"base": base, "copy": base}, [beat, 0.0], [None, None], snap=[row])
    level = step(sp.out, sp.joins[0])
    verdict, detail = repeat_verdict(level)
    if verdict != "ok":
        return rerender("level_step", detail, snap=[row], level_step_db=round(level, 3))
    sp.facts["level_step_db"] = round(level, 3)
    return sp


def _gap_shift(base, before: float, after: float, beat: float) -> tuple[float, float]:
    """(shift s, dB quieter than at the downbeat) for both cut points, or (0, dip) if no gap."""
    half, end = beat / 8, len(base) / SR

    def loud(d: float) -> float:
        return max(band_level(base, before + d, half), band_level(base, after + d, half))

    at_downbeat = loud(0.0)
    shifts = [d for d in np.arange(GAP_RANGE_BEATS[0] * beat, GAP_RANGE_BEATS[1] * beat, 0.01)
              if before + d - half > 0 and after + d + half < end]
    if not shifts:
        return 0.0, 0.0
    scored = [(loud(d) + GAP_PENALTY_DB_PER_BEAT * abs(d) / beat, d) for d in shifts]
    best = min(scored)[1]
    dip = at_downbeat - loud(best)
    return (round(float(best), 3), round(dip, 2)) if dip >= GAP_MIN_DIP_DB else (0.0, round(dip, 2))


def _edge_fade(sp, at: float, width: float, fade_in: bool):
    """Fade the output in (song start) or out (song end) over [at, at + width]."""
    a, b = int(round(at * SR)), int(round((at + width) * SR))
    curve = np.sin(np.linspace(0.0, np.pi / 2, b - a)).astype(np.float32)[:, None]
    sp.out[a:b] *= curve if fade_in else curve[::-1]
    sp.edges.append((round(at, 7), round(at + width, 7)))
    return sp


def splice_cut(base, gb, s: int, e: int):
    """Bars [s, e) (0-based) removed."""
    beat, end, n = gb.beat, len(base) / SR, gb.bars
    if s == 0:  # the song now starts at bar e: its pickup beat fades in
        start = max(gb.t(e) - beat, 0.0)
        sp = build([("base", start, end)], {"base": base}, [], [], gap_shift_s=0.0)
        return _edge_fade(sp, 0.0, gb.t(e) - start, fade_in=True)
    if e >= n:  # the song now ends at bar s: the cut section's first beat rings out
        tb_s = gb.t(s)
        sp = build([("base", 0.0, min(tb_s + beat, end))], {"base": base}, [], [], gap_shift_s=0.0)
        return _edge_fade(sp, tb_s, min(beat, end - tb_s), fade_in=False)
    tb_s, tb_e = gb.t(s), gb.t(e)
    snapped, row = snap(base, tb_s, base, tb_e, beat, "next")
    if row["corr"] < CORR_MIN:
        return rerender("not_aligned", "no groove to line the cut up on", snap=[row])
    shift, dip = _gap_shift(base, tb_s, tb_e + snapped, beat)
    width = beat / 4 if shift else beat
    return build([("base", 0.0, tb_s + shift), ("base", tb_e + snapped + shift, end)], {"base": base},
                 [width], [None], snap=[row], gap_shift_s=shift, gap_dip_db=dip)
