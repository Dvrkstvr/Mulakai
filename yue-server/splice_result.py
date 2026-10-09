"""The splice job's result JSON (one shape for both verdicts, so the server's
fake can replay it) and the spliced version's own grid: each piece's downbeats
and chord rows moved to where that piece sits in the output (`source:
mapped`), so the next edit of the new version needs no SheetSage2 run. A chain's
result (`kind: "several"`) carries one row per step and composes the grid
step by step: each step's input grid is the grid the step before it mapped."""
from __future__ import annotations

from splice_dsp import SR
from splice_grid import GRID_V

SNAP_SLACK = 0.1  # s; a snap moves a cut by at most 80 ms


def mapped_grid(splice, fits: dict, duration: float) -> dict:
    down, rows = [], []
    for part in splice.part_rows():
        fit = fits["render" if part["source"] == "render" else "base"]
        (o0, o1), (s0, s1) = part["out_s"], part["src_s"]
        # a downbeat the snap moved just before a piece's start is that piece's first bar line
        down += [round(max(t - s0 + o0, o0), 4) for t in fit.downbeats if s0 - SNAP_SLACK <= t < s1 - SNAP_SLACK]
        for a, b, label in fit.chords:
            if b > s0 and a < s1:
                rows.append([round(max(a, s0) - s0 + o0, 4), round(min(b, s1) - s0 + o0, 4), label])
    down = [t for k, t in enumerate(down) if k == 0 or t - down[k - 1] > 0.25]  # no double bar at a join
    return {"grid_v": GRID_V, "source": "mapped", "downbeats": down, "chords": rows, "duration": round(duration, 4)}


def _urls(steps) -> dict:
    return {which: (f"/v1/splices/{steps.job_id}/grid/{which}" if (steps.dir / f"{which}.grid.json").is_file() else None)
            for which in ("base", "render", "out")}


def _row(splice, kind: str, span) -> dict:
    s, e = span
    facts = splice.facts
    return {
        "verdict": splice.verdict, "reason": splice.reason, "detail": splice.detail,
        "kind": kind, "bars": [s + 1, e],
        "audio_seconds": None, "length_diff_s": facts.get("length_diff_s"),
        "joins_s": [], "crossfade_s": [], "base_points_s": [], "parts": [], "edges": [],
        "snap": facts.get("snap", []), "gain_db": facts.get("gain_db"),
        "level_step_db": facts.get("level_step_db"), "gap_shift_s": facts.get("gap_shift_s"),
        "seams": [], "null_test": None,
    }


def _ok_row(splice, kind: str, span, check: dict, seam_rows: list, length_diff: float) -> dict:
    row = _row(splice, kind, span)
    row.update(
        audio_seconds=round(len(splice.out) / SR, 4),
        length_diff_s=round(length_diff, 4), joins_s=[round(t, 4) for t in splice.joins],
        crossfade_s=[round(w, 6) for w in splice.widths],
        base_points_s=[None if p is None else round(p, 6) for p in splice.base_points],
        parts=splice.part_rows(), edges=[list(e) for e in splice.edges], seams=seam_rows,
        null_test={"samples": check["samples"], "different": check["different"]})
    return row


def rerender_result(splice, kind: str, spec: dict, steps) -> dict:
    return {**_row(splice, kind, spec["span"]), "audio_url": None, "grid_urls": _urls(steps)}


def ok_result(splice, kind: str, spec: dict, steps, check: dict, seam_rows: list, length_diff: float) -> dict:
    return {**_ok_row(splice, kind, spec["span"], check, seam_rows, length_diff),
            "audio_url": f"/v1/splices/{steps.job_id}/audio", "grid_urls": _urls(steps)}


# A chain (F-069): one verdict for the whole plan, one row per step run (the v1 row
# without the URLs; times in that step's own output), joins moved into the final file.
step_row = _row
ok_step_row = _ok_row


def _chain(spec: dict, steps, rows: list) -> dict:
    spans = [st["span"] for st in spec["steps"]]
    return {"kind": "several", "bars": [min(s for s, _ in spans) + 1, max(e for _, e in spans)],
            "steps": rows, "grid_urls": _urls(steps)}


def chain_rerender(splice, spec: dict, steps, rows: list, step: int | None) -> dict:
    return {**_chain(spec, steps, rows), "verdict": "rerender", "reason": splice.reason, "detail": splice.detail,
            "step": step, "audio_url": None, "audio_seconds": None, "length_diff_s": None, "joins_s": [],
            "null_test": None}


def chain_ok(spec: dict, steps, rows: list, joins: list, seconds: float, length_diff: float) -> dict:
    tests = [row["null_test"] for row in rows]
    return {**_chain(spec, steps, rows), "verdict": "ok", "reason": None, "detail": None, "step": None,
            "audio_url": f"/v1/splices/{steps.job_id}/audio", "audio_seconds": round(seconds, 4),
            "length_diff_s": round(length_diff, 4), "joins_s": [round(t, 4) for t, _ in joins],
            "null_test": {"samples": sum(t["samples"] for t in tests), "different": sum(t["different"] for t in tests)}}
