"""SP-4: what 'the rest moves' means in dB. For each full re-render (the control, today's behaviour) compare every UNEDITED bar with the same bar
of the base: bar loudness (LUFS) and spectral centroid. WSL venv python. -> results/drift_loudness.json"""
import json, numpy as np
from sp4lib import *
SPANS = json.load(open(f"{SPIKE}/spans.json"))
res = {}
for code, sp in SPANS.items():
    base = load(LIB + sp["vid"] + ".wav")
    gb = Grid(sp["base_ss"], sp["base_score"])
    for ename, ed in sp["edits"].items():
        s, e = ed["span"]; kind = ed["kind"]
        if kind != "local":
            continue
        new = load(f"{REN}/{ed['render']}/audio.flac")
        N = len(A.Sc(ed["score"]).bars)
        g = Grid(ed["render"], ed["score"], fit_idx=[i for i in range(N) if not (s <= i < e)])
        dl, dc = [], []
        for i in range(2, N - 2):
            if s - 1 <= i <= e:      # skip the edited bars and one bar each side
                continue
            b0, b1 = gb.t(i), gb.t(i + 1); n0, n1 = g.t(i), g.t(i + 1)
            if b1 <= b0 or n1 <= n0:
                continue
            xb = base[int(b0 * SR):int(b1 * SR)]; xn = new[int(n0 * SR):int(n1 * SR)]
            dl.append(lufs(xn) - lufs(xb)); dc.append(centroid(xn) - centroid(xb))
        dl, dc = np.array(dl), np.array(dc)
        res[f"{code}_{ename}"] = {"bars": len(dl), "lufs_delta_mean": float(dl.mean()), "lufs_abs_median": float(np.median(np.abs(dl))), "lufs_abs_p95": float(np.percentile(np.abs(dl), 95)),
                                  "lufs_abs_max": float(np.abs(dl).max()), "share_over_1dB": float((np.abs(dl) > 1).mean()), "centroid_abs_median_hz": float(np.median(np.abs(dc))), "centroid_abs_p95_hz": float(np.percentile(np.abs(dc), 95))}
        print(code, ename, {k: round(v, 2) for k, v in res[f"{code}_{ename}"].items()}, flush=True)
json.dump(res, open(f"{SPIKE}/results/drift_loudness.json", "w"), indent=1)
