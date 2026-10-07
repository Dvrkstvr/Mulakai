"""The splice's two machine checks (F-047 #2), shared by the job and by CP-C0:

- the null test: every sample of a base piece, away from the crossfades and
  any edge fade, equals the base sample it came from;
- the seams: the short-term loudness step (3 s either side) at each join, and
  how far it goes beyond the base's own step at the same place (SP-4's
  "excess"; a REPEAT or CUT seam has no base counterpart and is given raw).

CLI for CP-C0, on the saved library file:
    python splice_check.py <base audio> <saved audio> <splice result.json>
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np

from splice_dsp import SR, lufs, seconds

STEP_WINDOW = 3.0


def null_test(out: np.ndarray, base: np.ndarray, parts: list, widths: list, edges=()) -> dict:
    """parts: [{"source", "out_s": [o0, o1], "src_s": [t0, t1]}] in output order."""
    checked = different = 0
    worst = 0.0
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
        if hi <= lo:
            continue
        shift = int(round(part["src_s"][0] * SR)) - int(round(o0 * SR))
        a, b = out[lo:hi], base[lo + shift:hi + shift]
        n = min(len(a), len(b))
        diff = np.abs(a[:n] - b[:n])
        different += int(np.count_nonzero(diff.max(axis=1) > 0)) + (len(a) - n)
        checked += n
        worst = max(worst, float(diff.max()) if n else 0.0)
    return {"samples": checked, "different": different, "max_abs_diff": worst}


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


def main(argv: list[str]) -> int:
    from splice_audio import read_audio
    if len(argv) != 3:
        print(__doc__.strip().splitlines()[-1].strip(), file=sys.stderr)
        return 2
    base, saved = read_audio(Path(argv[0])), read_audio(Path(argv[1]))
    result = json.loads(Path(argv[2]).read_text(encoding="utf-8"))
    result = result.get("result", result)  # a job record or its result
    report = {"null_test": null_test(saved, base, result["parts"], result["crossfade_s"], result.get("edges", [])),
              "seams": seams(saved, result["joins_s"], base, result["base_points_s"]),
              "length_diff_s": round((len(saved) - len(base)) / SR, 4)}
    print(json.dumps(report, indent=1))
    excess = [abs(s["lufs_step_excess"]) for s in report["seams"] if s["lufs_step_excess"] is not None]
    return 0 if report["null_test"]["different"] == 0 and all(e <= 1.0 for e in excess) else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
