"""SP-6 measures (Windows python: numpy, scipy, soundfile). Per song and arm: inside the re-sung span vs v1's same seconds.
 - timbre: mean-MFCC distance (c1-c19 of a 40-band mel, 2048/512), long-term-spectrum distance (RMS dB over 1/3-octave bands after
   level normalisation), spectral centroid (power-weighted, whole span), band shares (sub 30-120, low-mid 120-500, mid 500-2k, hi 2k-12k) in dB
 - chords: bass-weighted chroma root per bar vs the plan's new root / the base's old root, and SheetSage2's chord rows (the out grid)
 - outside the span: sample-identity vs v1 (null test, recomputed here)
usage: python analyze.py  -> results.json, results.md"""
import json, os, re
import numpy as np, soundfile as sf
from scipy import signal
from scipy.fft import dct

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = "E:/ai/tmp/sp6/out"
INP = json.load(open(HERE + "/inputs.json"))
SR = 48000
BANDS = {"sub 30-120": (30, 120), "lowmid 120-500": (120, 500), "mid 500-2k": (500, 2000), "hi 2k-12k": (2000, 12000)}
NOTE = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}
ARMS = ["Z", "A", "B", "C", "D", "BD", "F", "FB", "P"]


def load(p):
    x, sr = sf.read(p, dtype="float32")
    assert sr == SR, sr
    return x


def mono(x):
    return x.mean(axis=1)


def stft_pow(x, n=4096, hop=1024):
    f, t, Z = signal.stft(x, SR, window="hann", nperseg=n, noverlap=n - hop, boundary=None, padded=False)
    return f, t, (np.abs(Z) ** 2)


def mel_fb(n_fft, n_mels=40, fmin=30, fmax=16000):
    mel = lambda f: 2595 * np.log10(1 + f / 700)
    inv = lambda m: 700 * (10 ** (m / 2595) - 1)
    pts = inv(np.linspace(mel(fmin), mel(fmax), n_mels + 2))
    bins = np.floor((n_fft + 1) * pts / SR).astype(int)
    fb = np.zeros((n_mels, n_fft // 2 + 1))
    for i in range(n_mels):
        a, b, c = bins[i], bins[i + 1], bins[i + 2]
        if b > a:
            fb[i, a:b] = (np.arange(a, b) - a) / (b - a)
        if c > b:
            fb[i, b:c] = (c - np.arange(b, c)) / (c - b)
    return fb


def mfcc_mean(x):
    n = 2048
    f, t, P = stft_pow(x, n, 512)
    fb = mel_fb(n)
    lm = np.log(fb @ P + 1e-10)
    M = dct(lm, type=2, axis=0, norm="ortho")[1:20]
    e = P.sum(axis=0)
    keep = e > np.percentile(e, 10)  # drop near-silent frames
    return M[:, keep].mean(axis=1)


def third_oct(x):
    f, t, P = stft_pow(x, 8192, 2048)
    ps = P.mean(axis=1)
    centers = 1000 * 2 ** (np.arange(-15, 14) / 3.0)  # ~31 Hz .. ~12.7 kHz
    out = []
    for c in centers:
        lo, hi = c / 2 ** (1 / 6), c * 2 ** (1 / 6)
        m = (f >= lo) & (f < hi)
        out.append(ps[m].sum() + 1e-14)
    out = np.array(out)
    return 10 * np.log10(out / out.sum())


def band_share(x):
    f, t, P = stft_pow(x, 8192, 2048)
    ps = P.mean(axis=1)
    tot = ps[(f >= 30) & (f < 12000)].sum()
    return {k: float(10 * np.log10(ps[(f >= lo) & (f < hi)].sum() / tot)) for k, (lo, hi) in BANDS.items()}


def centroid(x):
    f, t, P = stft_pow(x, 4096, 1024)
    ps = P.mean(axis=1)
    m = (f >= 30) & (f < 16000)
    return float((f[m] * ps[m]).sum() / ps[m].sum())


TEMPL = {}
for _r in range(12):
    for _q, _iv in (("maj", (0, 4, 7)), ("min", (0, 3, 7))):
        _t = np.zeros(12)
        for k in _iv:
            _t[(_r + k) % 12] = 1.0
        TEMPL[(_r, _q)] = _t / np.linalg.norm(_t)


def chroma_roots(x, windows):
    """triad root per [t0,t1): chroma of 80-2000 Hz (log-compressed, bass bins weighted x2), best of 24 major/minor templates"""
    f, t, P = stft_pow(x, 8192, 2048)
    m = (f >= 80) & (f < 2000)
    pcs = (np.round(12 * np.log2(f[m] / 440.0) + 69).astype(int)) % 12
    wt = np.where(f[m] < 250, 2.0, 1.0)
    roots = []
    for a, b in windows:
        sel = (t >= a) & (t < b)
        if sel.sum() == 0:
            roots.append(None)
            continue
        ps = np.log1p(P[m][:, sel].mean(axis=1) * 1e4) * wt
        c = np.zeros(12)
        np.add.at(c, pcs, ps)
        c = c - c.mean()
        best = max(TEMPL, key=lambda k: float(c @ TEMPL[k]))
        roots.append(best[0])
    return roots


def pc(name):
    m = re.match(r"([A-G])([#b]?)", name)
    v = NOTE[m.group(1)] + (1 if m.group(2) == "#" else -1 if m.group(2) == "b" else 0)
    return v % 12


def abc_bar_roots(abc):
    """first chord root per bar of the Vocal voice (carried forward when a bar has none)"""
    lines, voice = [], None
    for ln in abc.splitlines():
        if ln.startswith("V:"):
            voice = ln.split()[1]
            continue
        if voice == "Vocal" and ln and not ln.startswith(("%", "K:", "M:", "L:", "Q:", "X:", "T:")):
            lines.append(ln)
    bars = [b for ln in lines for b in ln.strip().rstrip("|").split("|") if b != ""]
    roots, cur = [], None
    for b in bars:
        m = re.search(r'"([A-G][#b]?)', b)
        if m:
            cur = pc(m.group(1))
        roots.append(cur)
    return roots


def analyse(key):
    s = INP[key]
    v1 = mono(load(s["v1_file"]))
    res = {}
    old = abc_bar_roots(s["base_abc"])
    new_by_bar = {}
    for bar, beat, root, q in s["roots"]:
        new_by_bar.setdefault(bar, pc(root))  # first chord of the bar
    a, b = s["span"]
    for arm in ARMS:
        d = f"{OUT}/{key}/{arm}"
        if not os.path.exists(d + "/spliced.wav"):
            continue
        y = mono(load(d + "/spliced.wav"))
        sj = json.load(open(d + "/splice_job.json"))["result"]
        j0, j1 = sj["joins_s"]
        i0, i1 = int(round(j0 * SR)), int(round(j1 * SR))
        n = min(len(y), len(v1))
        m = int(0.5 * SR)  # stay half a second inside the crossfades
        ys, vs = y[i0 + m:i1 - m], v1[i0 + m:i1 - m]
        r = dict(span_s=[j0, j1], mfcc=float(np.linalg.norm(mfcc_mean(ys) - mfcc_mean(vs))),
                 ltas=float(np.sqrt(np.mean((third_oct(ys) - third_oct(vs)) ** 2))),
                 centroid_hz=centroid(ys), centroid_v1_hz=centroid(vs), bands_db=band_share(ys), bands_v1_db=band_share(vs))
        og = json.load(open(d + "/grid_out.json"))
        bg = json.load(open(d + "/grid_base.json"))
        L = (j1 - j0) / (b - a + 1)  # the span is steady in tempo: bar k starts at j0 + (k - a) * L (the joins are the span's first/last downbeats)
        def sheet(g, t):
            lab = [c[2] for c in g.get("chords", []) if c[0] <= t < c[1]]
            return pc(lab[0]) if lab and re.match(r"[A-G]", lab[0]) else None
        rows = []
        for bar in range(a, b + 1):
            if bar not in new_by_bar or bar - 1 >= len(old) or old[bar - 1] is None:
                continue
            t0 = j0 + (bar - a) * L
            w = [(t0 + 0.05 * L, t0 + 0.45 * L)]  # beat 1-2 of the bar: the plan's first chord of the bar
            rows.append(dict(bar=bar, new=new_by_bar[bar], old=old[bar - 1], arm=chroma_roots(y, w)[0], v1=chroma_roots(v1, w)[0],
                             ss_arm=sheet(og, t0 + 0.25 * L), ss_v1=sheet(bg, t0 + 0.25 * L)))
        diff = [x for x in rows if x["new"] != x["old"]]  # bars where the plan moves the root
        k = max(1, len(diff))
        frac = lambda f: sum(f(x) for x in diff) / k
        r["bars_changed_root"] = len(diff)
        r["tri_root_is_new"] = frac(lambda x: x["arm"] == x["new"])
        r["tri_root_is_old"] = frac(lambda x: x["arm"] == x["old"])
        r["v1_tri_root_is_new"] = frac(lambda x: x["v1"] == x["new"])
        r["v1_tri_root_is_old"] = frac(lambda x: x["v1"] == x["old"])
        r["tri_root_differs_from_v1"] = frac(lambda x: x["arm"] != x["v1"])
        r["ss_root_is_new"] = frac(lambda x: x["ss_arm"] == x["new"])
        r["ss_root_is_old"] = frac(lambda x: x["ss_arm"] == x["old"])
        r["v1_ss_root_is_new"] = frac(lambda x: x["ss_v1"] == x["new"])
        r["v1_ss_root_is_old"] = frac(lambda x: x["ss_v1"] == x["old"])
        r["ss_root_differs_from_v1"] = frac(lambda x: x["ss_arm"] != x["ss_v1"])
        # null test: the job's own (aligned to the base's own sample positions) + head and tail recomputed here
        head = int((y[:i0 - SR] != v1[:i0 - SR]).sum())
        shift = len(v1) - len(y)
        tail = int((y[i1 + SR:] != v1[i1 + SR + shift:][:len(y) - i1 - SR]).sum())
        r["head_differing"], r["tail_differing"], r["tail_shift_samples"] = head, tail, shift
        r["splice_verdict"] = sj["verdict"]
        r["null_test"] = sj["null_test"]
        res[arm] = r
    for arm, r in res.items():
        if "A" in res:
            r["mfcc_vs_A"] = r["mfcc"] / res["A"]["mfcc"]
            r["ltas_vs_A"] = r["ltas"] / res["A"]["ltas"]
    return res


if __name__ == "__main__":
    allr = {k: analyse(k) for k in INP}
    json.dump(allr, open(HERE + "/results.json", "w"), indent=1, default=float)
    L = []
    fmt = lambda v: "-" if v is None else f"{v:.2f}"
    for k, res in allr.items():
        L.append(f"\n### {k}  (span bars {INP[k]['span']})\n")
        L.append("| arm | MFCC dist | /A | LTAS dB | /A | centroid Hz (v1) | sub dB (v1) | lowmid dB (v1) | triad root=new (v1) | =old (v1) | differs from v1 | SheetSage root=new (v1) | differs from v1 | null (job) | head/tail diff |")
        L.append("|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|")
        for arm, r in res.items():
            bd, bv = r["bands_db"], r["bands_v1_db"]
            L.append(f"| {arm} | {r['mfcc']:.2f} | {fmt(r.get('mfcc_vs_A'))} | {r['ltas']:.2f} | {fmt(r.get('ltas_vs_A'))} | {r['centroid_hz']:.0f} ({r['centroid_v1_hz']:.0f}) | "
                     f"{bd['sub 30-120']:.1f} ({bv['sub 30-120']:.1f}) | {bd['lowmid 120-500']:.1f} ({bv['lowmid 120-500']:.1f}) | "
                     f"{r['tri_root_is_new']:.2f} ({r['v1_tri_root_is_new']:.2f}) | {r['tri_root_is_old']:.2f} ({r['v1_tri_root_is_old']:.2f}) | {r['tri_root_differs_from_v1']:.2f} | "
                     f"{r['ss_root_is_new']:.2f} ({r['v1_ss_root_is_new']:.2f}) | {r['ss_root_differs_from_v1']:.2f} | {r['null_test']['different']}/{r['null_test']['samples']} | {r['head_differing']}/{r['tail_differing']} |")
    open(HERE + "/results.md", "w").write("\n".join(L))
    print("\n".join(L))
