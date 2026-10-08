"""SP-6, the calibrated view: every arm's RENDER (before splicing) against v1, with the arms that have no edit as the yardstick.
 Z  = v1's score re-rendered with v1's seed (no edit at all)       S = the same with seed+1 (a plain re-roll)
 V  = v1's own first-generation request (the model plans its own score; only Acid and Gertar)
 A..BD = the edited score, arms as in RESULT.md.  F/FB = forced-prefix arms (no splice, A's render span).
Windows: v1's span is the splice's joins (v1 time); an arm's span is its own render-side span from its splice (A's for S/V/F/FB).
Reports MFCC and LTAS distance to v1 for (a) the span and (b) the WHOLE song (long, so robust), plus the relative pull in the sub-bass and low-mid bands.
usage: python analyze2.py -> results2.json, results2.md"""
import json, os
import numpy as np
from analyze import INP, OUT, SR, load, mono, mfcc_mean, third_oct, band_share, centroid

HERE = os.path.dirname(os.path.abspath(__file__))
ARMS = ["V", "Z", "S", "A", "B", "C", "D", "BD", "F", "FB", "P"]


def feats(x):
    return dict(m=mfcc_mean(x), l=third_oct(x), c=centroid(x), b=band_share(x))


def dist(f, g):
    return dict(mfcc=float(np.linalg.norm(f["m"] - g["m"])), ltas=float(np.sqrt(np.mean((f["l"] - g["l"]) ** 2))),
                dcen=float(f["c"] - g["c"]), dsub=float(f["b"]["sub 30-120"] - g["b"]["sub 30-120"]), dlow=float(f["b"]["lowmid 120-500"] - g["b"]["lowmid 120-500"]))


def render_path(key, arm):
    for ext in ("flac", "wav"):
        p = f"{OUT}/{key}/{arm}/render.{ext}"
        if os.path.exists(p):
            return p


def own_span(key, arm):
    for a in (arm, "A"):
        p = f"{OUT}/{key}/{a}/splice_job.json"
        if os.path.exists(p):
            r = json.load(open(p))["result"]
            return [q for q in r["parts"] if q["source"] == "render"][0]["src_s"]


res = {}
m = int(0.5 * SR)
for key, s in INP.items():
    aj = json.load(open(f"{OUT}/{key}/A/splice_job.json"))["result"]
    j0, j1 = aj["joins_s"]
    v1 = mono(load(s["v1_file"]))
    fv_span, fv_all = feats(v1[int(j0 * SR) + m:int(j1 * SR) - m]), feats(v1)
    res[key] = {}
    for arm in ARMS:
        p = render_path(key, arm)
        if not p:
            continue
        y = mono(load(p))
        r0, r1 = own_span(key, arm)
        res[key][arm] = dict(span=dist(feats(y[int(r0 * SR) + m:int(r1 * SR) - m]), fv_span), whole=dist(feats(y), fv_all), seconds=len(y) / SR, span_s=[round(r0, 2), round(r1, 2)])
L = []
for key, r in res.items():
    L.append(f"\n### {key}: render vs v1 (span bars {INP[key]['span']}; v1 {len(mono(load(INP[key]['v1_file'])))/SR:.1f} s)\n")
    L.append("| arm | span MFCC | span LTAS | span dCentroid Hz | span dSub dB | span dLowMid dB | whole MFCC | whole LTAS | whole dSub | whole dLowMid | length s | span s |")
    L.append("|---|---|---|---|---|---|---|---|---|---|---|---|")
    for arm, d in r.items():
        a, w = d["span"], d["whole"]
        L.append(f"| {arm} | {a['mfcc']:.2f} | {a['ltas']:.2f} | {a['dcen']:+.0f} | {a['dsub']:+.1f} | {a['dlow']:+.1f} | {w['mfcc']:.2f} | {w['ltas']:.2f} | {w['dsub']:+.1f} | {w['dlow']:+.1f} | {d['seconds']:.1f} | {d['span_s'][1]-d['span_s'][0]:.1f} |")
json.dump(res, open(HERE + "/results2.json", "w"), indent=1)
open(HERE + "/results2.md", "w").write("\n".join(L))
print("\n".join(L))
