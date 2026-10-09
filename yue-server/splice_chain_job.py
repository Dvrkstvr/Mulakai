"""The chained splice job (F-069, D-263, D-267), on the worker thread: the
proven single-span splice applied once per step to the audio in memory, last
bar first. The base is decoded and its grid fitted once; the render and its
grid are read once when a step is a REHARMONIZE. Each step reuses the base's
grid fit: it only reads audio before the step's end and a few bars after its
last join, which the steps before it (higher bars) left alone or only
replaced from their own first join on (the server's planner keeps 2 bars and
3 s between spans, D-265).

Each step is null-tested in memory against its own input; the first step
that is not `ok` ends the job `rerender` for the whole plan with that step's
index and reason, and no audio is written. At the end the WAV is written,
read back and compared bitwise with the in-memory output, and the out grid
is the grid mapped through every step. Cancel is checked between steps.
"""
from __future__ import annotations

import json
from dataclasses import replace
from pathlib import Path
from types import SimpleNamespace

import numpy as np

from splice_audio import read_audio, write_wav
from splice_chain import ChainError, fit_bars, map_spans
from splice_check import final_joins, null_test, seams
from splice_dsp import SR
from splice_fit import ShortSide, side_fits
from splice_grid import fit, score_bars
from splice_job import SpliceFailure, _render
from splice_plan import Splice, rerender, splice_reharmonize
from splice_result import chain_ok, chain_rerender, mapped_grid, ok_step_row, step_row
from splice_sections import splice_cut, splice_repeat


def _render_side(steps, store, spec: dict):
    """(render audio, its grid, the edited score, the mapped spans) or a rerender Splice."""
    audio_path, edited = _render(store, spec)
    new = read_audio(audio_path)
    sb = score_bars(edited)
    if not sb.four_four:
        return rerender("meter", "the edited score is not in 4/4 throughout")
    new_grid = steps.grid("render", audio_path)
    if new_grid is None:
        return rerender("no_grid", "no downbeat grid for the new take")
    try:
        mapped = map_spans(spec["steps"], len(score_bars(spec["base_abc"]).chords), len(sb.chords))
    except ChainError as error:
        return rerender("bar_map", str(error))
    return SimpleNamespace(audio=new, grid=new_grid, abc=edited, n=len(sb.chords), mapped=mapped)


def _step(current, gb, k: int, st: dict, render):
    """One step on the current audio: (Splice, the fits its pieces' grids come from)."""
    kind, (s, e) = st["op"]["op"], st["span"]
    if kind != "REHARMONIZE":
        return (splice_repeat if kind == "REPEAT" else splice_cut)(current, gb, s, e), {}
    ms = render.mapped[k][0]
    pre, post = fit_bars(render.mapped, k, render.n)
    # the render's fits, moved so their bar s is the render's bar ms (its span's start in the edited score)
    try:
        g_pre, g_post = side_fits(render.grid, render.abc, pre, post)  # R-044: one loop off on a short side
    except ShortSide as short:
        return rerender("length", str(short)), {}
    g_pre, g_post = replace(g_pre, offset=g_pre.offset + ms - s), replace(g_post, offset=g_post.offset + ms - s)
    return splice_reharmonize(current, render.audio, gb, g_pre, g_post, s, e), {"render": g_pre}


def run(steps, store, request: dict) -> dict:
    spec, source = request["spec"], Path(request["source"])
    chain, count = spec["steps"], len(spec["steps"])
    steps.enter("decoding")
    base = read_audio(source)
    if not score_bars(spec["base_abc"]).four_four:
        reason = "the song is not in 4/4 throughout (the splice was tested on 4/4 only)"
        return chain_rerender(rerender("meter", reason), spec, steps, [], None)
    base_grid = steps.grid("base", source, spec.get("base_grid"))
    if base_grid is None:
        return chain_rerender(rerender("no_grid", "no downbeat grid for the current version"), spec, steps, [], None)
    gb = fit(base_grid, spec["base_abc"])
    render = None
    if any(st["op"]["op"] == "REHARMONIZE" for st in chain):
        render = _render_side(steps, store, spec)
        if isinstance(render, Splice):
            return chain_rerender(render, spec, steps, [], None)
    current, grid_in, rows = base, gb, []
    for k, st in enumerate(chain):
        kind, span = st["op"]["op"], st["span"]
        if span[0] + gb.offset >= len(gb.downbeats):
            sp = rerender("no_grid", "the grid ends before the edited bars")
            return chain_rerender(sp, spec, steps, rows + [step_row(sp, kind, span)], k + 1)
        steps.enter(f"splicing {k + 1}/{count}")
        sp, fits = _step(current, gb, k, st, render)
        if sp.verdict != "ok":
            return chain_rerender(sp, spec, steps, rows + [step_row(sp, kind, span)], k + 1)
        check = null_test(sp.out, current, sp.part_rows(), sp.widths, sp.edges)
        if check["different"]:
            raise SpliceFailure("null_test_failed", f"step {k + 1}: {check['different']} samples of its input "
                                                    "changed outside the crossfades")
        rows.append(ok_step_row(sp, kind, span, check, seams(sp.out, sp.joins, current, sp.base_points),
                                (len(sp.out) - len(current)) / SR))
        mapped = mapped_grid(sp, {"base": grid_in, **fits}, len(sp.out) / SR)
        grid_in, current = SimpleNamespace(downbeats=mapped["downbeats"], chords=mapped["chords"]), sp.out
    steps.enter("checking")
    write_wav(steps.dir / "audio.wav", current)
    saved = read_audio(steps.dir / "audio.wav")
    if saved.shape != current.shape or not np.array_equal(saved, current):
        raise SpliceFailure("null_test_failed", "the written file differs from the spliced audio")
    (steps.dir / "out.grid.json").write_text(json.dumps(mapped), encoding="utf-8")
    return chain_ok(spec, steps, rows, final_joins(rows), len(saved) / SR, (len(saved) - len(base)) / SR)
