"""SP-4: sanity check of one healed file against its input: format, length, where the samples differ. WSL venv python."""
import sys, numpy as np
from sp4lib import *
src, out = sys.argv[1], sys.argv[2]
wins = [(float(a), float(b)) for a, b in (w.split(",") for w in sys.argv[3:])]
a = load(src); b = load(out)
print("len in/out", len(a), len(b), "diff samples", len(b) - len(a))
n = min(len(a), len(b)); d = np.abs(a[:n] - b[:n]).max(axis=1)
idx = np.flatnonzero(d > 1e-4)
print("samples differing >1e-4:", len(idx), "=", len(idx) / SR, "s; max diff", float(d.max()))
if len(idx):
    # contiguous ranges
    br = np.flatnonzero(np.diff(idx) > SR // 10); starts = np.r_[idx[0], idx[br + 1]]; ends = np.r_[idx[br], idx[-1]]
    for s, e in zip(starts, ends):
        print(f"  differs {s / SR:.2f}-{e / SR:.2f} s")
for w in wins:
    i0, i1 = int(w[0] * SR), int(w[1] * SR)
    print("window", w, "rms in", float(np.sqrt((a[i0:i1] ** 2).mean())), "rms out", float(np.sqrt((b[i0:i1] ** 2).mean())), "lufs in/out", round(lufs(a[i0:i1]), 2), round(lufs(b[i0:i1]), 2))
