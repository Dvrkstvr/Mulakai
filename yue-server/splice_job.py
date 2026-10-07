"""The `splice` job body, on the worker thread (docs/decisions/0005): decode the
base (and, for REHARMONIZE, the named YuE2 render, whose audio never left this
server), get both downbeat grids (the base's from the server's cache when sent,
else SheetSage2), splice, write a float32 WAV, read it back and null-test the
file. Cancel is checked between steps; a cancelled splice deletes its files.

The result's `verdict` is `ok` (audio at `audio_url`) or `rerender` with a
`reason` (meter, no_grid, render_truncated, not_aligned, level_step, length): for
REHARMONIZE the server then keeps its whole re-render (D-101), for REPEAT and
CUT it renders the edited score (D-154).
"""
from __future__ import annotations

import json
import logging
import shutil
import time
from pathlib import Path

from splice_audio import AudioError, read_audio, write_wav
from splice_check import null_test, seams
from splice_dsp import SR
from splice_grid import GridError, fit, score_bars, track
from splice_plan import rerender, splice_reharmonize
from splice_result import mapped_grid, ok_result, rerender_result
from splice_sections import splice_cut, splice_repeat
from transcriber import TranscriptionError

log = logging.getLogger("yue-server")


class SpliceFailure(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


def sheetsage_tracker(transcriber):
    """The grid source: SheetSage2 through the transcription subprocess, when configured."""
    def run(source: Path, out: Path, *, cancelled, on_progress) -> dict:
        status, detail = transcriber.status()
        if status != "ready":
            raise TranscriptionError(status, detail)
        return track(transcriber, source, out, cancelled=cancelled, on_progress=on_progress)
    return run


class _Steps:
    def __init__(self, store, job_id: str, tracker):
        self.store, self.job_id, self.tracker = store, job_id, tracker
        self.dir = store.artifact_dir(job_id)

    def enter(self, stage: str) -> None:
        if self.store.cancelled(self.job_id):
            raise InterruptedError(f"Cancelled before {stage}")
        self.store.progress(self.job_id, stage=stage, progress=None)

    def grid(self, which: str, source: Path, cached=None) -> dict | None:
        """A take's grid (cached, or tracked now), saved as <which>.grid.json; None if none."""
        if cached is None:
            if self.tracker is None:
                return None
            self.enter(f"tracking_{which}")
            try:
                cached = self.tracker(source, self.dir / f"{which}-track", cancelled=lambda: self.store.cancelled(self.job_id),
                                      on_progress=lambda f: self.store.progress(self.job_id, progress=f))
            except (TranscriptionError, GridError, OSError, KeyError, ValueError) as error:
                log.warning("splice %s: no %s grid: %s", self.job_id, which, error)
                return None
        (self.dir / f"{which}.grid.json").write_text(json.dumps(cached), encoding="utf-8")
        return cached


def _render(store, spec: dict) -> tuple[Path, str]:
    job_id = spec["render_job"]
    job = store.get(job_id, kind="song")
    folder = store.artifact_dir(job_id)
    if job is None or job["status"] not in {"succeeded", "truncated"} or not (folder / "audio.flac").is_file():
        raise SpliceFailure("render_unavailable", f"render job {job_id} has no audio on this server")
    abc = spec.get("edited_abc") or (folder / "score.abc").read_text(encoding="utf-8")
    return folder / "audio.flac", abc


def _splice(steps: _Steps, store, request: dict) -> dict:
    spec, source = request["spec"], Path(request["source"])
    kind, (s, e) = spec["op"]["op"], spec["span"]
    steps.enter("decoding")
    base = read_audio(source)
    if not score_bars(spec["base_abc"]).four_four:
        reason = "the song is not in 4/4 throughout (the splice was tested on 4/4 only)"
        return rerender_result(rerender("meter", reason), kind, spec, steps)
    base_grid = steps.grid("base", source, spec.get("base_grid"))
    if base_grid is None:
        return rerender_result(rerender("no_grid", "no downbeat grid for the current version"), kind, spec, steps)
    gb = fit(base_grid, spec["base_abc"])
    if s + gb.offset >= len(gb.downbeats):
        return rerender_result(rerender("no_grid", "the grid ends before the edited bars"), kind, spec, steps)
    fits = {"base": gb}
    if kind == "REHARMONIZE":
        audio_path, edited = _render(store, spec)
        new = read_audio(audio_path)
        if not score_bars(edited).four_four:
            return rerender_result(rerender("meter", "the edited score is not in 4/4 throughout"), kind, spec, steps)
        new_grid = steps.grid("render", audio_path)
        if new_grid is None:
            return rerender_result(rerender("no_grid", "no downbeat grid for the new take"), kind, spec, steps)
        n = len(score_bars(edited).chords)
        fits["render"] = fit(new_grid, edited, range(0, s))
        post = fit(new_grid, edited, range(e, n))
        steps.enter("splicing")
        splice = splice_reharmonize(base, new, gb, fits["render"], post, s, e)
    else:
        steps.enter("splicing")
        splice = (splice_repeat if kind == "REPEAT" else splice_cut)(base, gb, s, e)
    if splice.verdict != "ok":
        return rerender_result(splice, kind, spec, steps)
    steps.enter("checking")
    write_wav(steps.dir / "audio.wav", splice.out)
    saved = read_audio(steps.dir / "audio.wav")
    check = null_test(saved, base, splice.part_rows(), splice.widths, splice.edges)
    if check["different"]:
        raise SpliceFailure("null_test_failed", f"{check['different']} base samples changed outside the crossfades")
    (steps.dir / "out.grid.json").write_text(json.dumps(mapped_grid(splice, fits, len(saved) / SR)), encoding="utf-8")
    return ok_result(splice, kind, spec, steps, check, seams(saved, splice.joins, base, splice.base_points),
                     (len(saved) - len(base)) / SR)


def run_splice(tracker, store, job_id: str, request: dict) -> None:
    started = time.monotonic()
    steps = _Steps(store, job_id, tracker)
    steps.dir.mkdir(parents=True, exist_ok=True)
    log.info("splice %s started (%s)", job_id, request["spec"]["op"]["op"])
    try:
        result = _splice(steps, store, request)
        result["timing"] = {"total_seconds": round(time.monotonic() - started, 3)}
        outcome = ("succeeded", result, None)
    except InterruptedError:
        outcome = ("cancelled", None, None)
    except SpliceFailure as error:
        outcome = ("failed", None, {"code": error.code, "message": str(error)})
    except AudioError as error:
        outcome = ("failed", None, {"code": "audio_unreadable", "message": str(error)})
    except Exception as error:  # every failure must reach the job record
        log.error("splice failed", exc_info=error)
        outcome = ("failed", None, {"code": "splice_failed", "message": f"{type(error).__name__}: {error}"})
    status, result, error = outcome
    if status == "cancelled" or store.cancelled(job_id):
        shutil.rmtree(steps.dir, ignore_errors=True)
    log.info("splice %s %s%s", job_id, status, f": {error['message']}" if error else "")
    store.finish(job_id, status, result=result, error=error)
