"""The splice's two machine checks (F-047 #2), shared by the job and by CP-C0:

- the null test: every sample of a base piece, away from the crossfades and
  any edge fade, equals the base sample it came from;
- the seams: the short-term loudness step (3 s either side) at each join, and
  how far it goes beyond the base's own step at the same place (SP-4's
  "excess"; a REPEAT or CUT seam has no base counterpart and is given raw).

A chain (F-069) is checked on the saved file against the ORIGINAL base with
the steps' part maps composed (`compose`), and every step's joins moved to
where they sit in the final file (`final_joins`).

CLI for CP-C0 / CP-C4, on the saved library file:
    python splice_check.py <base audio> <saved audio> <splice result.json>
    python splice_check.py --chain <base audio> <saved audio> <chain result.json>
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np

from splice_dsp import SR, lufs, seconds

STEP_WINDOW = 3.0


def _kept(parts: list, widths: list, edges=()) -> list[tuple[int, int, int]]:
    """The base pieces' samples away from the crossfades and edge fades, as
    (lo, hi, shift): out[lo:hi] came from the input at [lo + shift, hi + shift)."""
    kept = []
    for k, part in enumerate(parts):
        if part["source"] != "base":
            continue
        o0, o1 = part["out_s"]
        lo = int(round(o0 * SR)) + (int(round(widths[k - 1] * SR / 2)) + 1 if k > 0 else 0)
        hi = int(round(o1 * SR)) - (int(round(widths[k] * SR / 2)) + 1 if k < len(parts) - 1 else 0)
        for e0, e1 in edges:
            if int(round(e0 * SR)) <= lo:
                lo = max(lo, int(round(e1 * SR)) + 1)
            else:
                hi = min(hi, int(round(e0 * SR)) - 1)
        if hi > lo:
            kept.append((lo, hi, int(round(part["src_s"][0] * SR)) - int(round(o0 * SR))))
    return kept


def null_test_map(out: np.ndarray, base: np.ndarray, kept: list) -> dict:
    checked = different = 0
    worst = 0.0
    for lo, hi, shift in kept:
        a, b = out[lo:hi], base[lo + shift:hi + shift]
        n = min(len(a), len(b))
        diff = np.abs(a[:n] - b[:n])
        different += int(np.count_nonzero(diff.max(axis=1) > 0)) + (len(a) - n)
        checked += n
        worst = max(worst, float(diff.max()) if n else 0.0)
    return {"samples": checked, "different": different, "max_abs_diff": worst}


def null_test(out: np.ndarray, base: np.ndarray, parts: list, widths: list, edges=()) -> dict:
    """parts: [{"source", "out_s": [o0, o1], "src_s": [t0, t1]}] in output order."""
    return null_test_map(out, base, _kept(parts, widths, edges))


def compose(rows: list[dict]) -> list[tuple[int, int, int]]:
    """A chain's steps (result rows, in the order applied) as one map from the final
    output to the original base: the samples every step kept, traced back through each."""
    segs = None
    for row in rows:
        mine = _kept(row["parts"], row["crossfade_s"], row.get("edges", []))
        if segs is None:
            segs = mine
            continue
        segs = [(max(lo + sh, a) - sh, min(hi + sh, b) - sh, sh + s0)
                for lo, hi, sh in mine for a, b, s0 in segs if min(hi + sh, b) > max(lo + sh, a)]
    return segs or []


def _later(t: float, parts: list) -> float:
    """A time of a step's input in that step's output (inside a piece taken from the input)."""
    for part in parts:
        (o0, _), (s0, s1) = part["out_s"], part["src_s"]
        if part["source"] == "base" and s0 <= t <= s1:
            return o0 + t - s0
    return t  # before every cut (the input's head is the output's)


def final_joins(rows: list[dict]) -> list[tuple[float, float | None]]:
    """Every step's joins in the final output's time, with the base time each matches (or None)."""
    out = []
    for k, row in enumerate(rows):
        for t, point in zip(row["joins_s"], row["base_points_s"]):
            for later in rows[k + 1:]:
                t = _later(t, later["parts"])
            out.append((t, point))
    return out


def step(x: np.ndarray, t: float) -> float:
    return lufs(seconds(x, t, t + STEP_WINDOW)) - lufs(seconds(x, t - STEP_WINDOW, t))


def seams(out: np.ndarray, joins: list, base: np.ndarray, base_points: list) -> list[dict]:
    rows = []
    for k, t in enumerate(joins):
        row = {"out_s": round(t, 4), "lufs_step": round(step(out, t), 3), "base_lufs_step": None,
               "lufs_step_excess": None}
        point = base_points[k] if k < len(base_points) else None
        if point is not None:
            base_step = step(base, point)
            row.update(base_lufs_step=round(base_step, 3), lufs_step_excess=round(row["lufs_step"] - base_step, 3))
        rows.append(row)
    return rows


def check_chain(saved: np.ndarray, base: np.ndarray, result: dict) -> dict:
    """A chain's saved file against the original base: the composed null test, every join's excess."""
    rows = result["steps"]
    joins = final_joins(rows)
    return {"null_test": null_test_map(saved, base, compose(rows)),
            "seams": seams(saved, [t for t, _ in joins], base, [p for _, p in joins])}


def main(argv: list[str]) -> int:
    from splice_audio import read_audio
    chain = argv[:1] == ["--chain"]
    argv = argv[1:] if chain else argv
    if len(argv) != 3:
        print("\n".join(line.strip() for line in __doc__.strip().splitlines()[-2:]), file=sys.stderr)
        return 2
    base, saved = read_audio(Path(argv[0])), read_audio(Path(argv[1]))
    result = json.loads(Path(argv[2]).read_text(encoding="utf-8"))
    result = result.get("result", result)  # a job record or its result
    if chain:
        report = check_chain(saved, base, result)
    else:
        report = {"null_test": null_test(saved, base, result["parts"], result["crossfade_s"], result.get("edges", [])),
                  "seams": seams(saved, result["joins_s"], base, result["base_points_s"])}
    report["length_diff_s"] = round((len(saved) - len(base)) / SR, 4)
    print(json.dumps(report, indent=1))
    excess = [abs(s["lufs_step_excess"]) for s in report["seams"] if s["lufs_step_excess"] is not None]
    return 0 if report["null_test"]["different"] == 0 and all(e <= 1.0 for e in excess) else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
