"""Aggregate results/<tag>.jsonl into per-template tables. Usage: python report.py tag [tag...]"""
import json, os, re, statistics, sys
HERE = os.path.dirname(os.path.abspath(__file__))


def load(tag):
    rows = []
    for ln in open(os.path.join(HERE, "results", tag + ".jsonl"), encoding="utf-8"):
        rows.append(json.loads(ln))
    return rows


def pct(a, b):
    return f"{a}/{b} ({100 * a / b:.0f}%)" if b else "-"


def q(xs, p):
    xs = sorted(xs)
    if not xs:
        return float("nan")
    k = (len(xs) - 1) * p
    lo, hi = int(k), min(int(k) + 1, len(xs) - 1)
    return xs[lo] + (xs[hi] - xs[lo]) * (k - lo)


def norm(e):
    e = re.sub(r"\d+", "N", e)
    return e[:110]


def summarize(tag, detail=True):
    rows = [r for r in load(tag) if "attempts" in r]
    skipped = [r for r in load(tag) if "attempts" not in r]
    out = [f"### {tag}: {len(rows)} plans ({len(skipped)} infeasible cases skipped)"]
    tm = sorted({r["tmpl"] for r in rows})
    out.append("| template | n | schema ok (1st) | valid 1st try | valid + intent 1st | valid <=3 retries | valid + intent final | retries used (0/1/2/3/fail) | p50 s | p95 s |")
    out.append("|---|---|---|---|---|---|---|---|---|---|")
    groups = {}
    for t in tm + ["DETERMINISTIC (T1,T2,T4,T5)", "ALL"]:
        if t.startswith("DETER"):
            rs = [r for r in rows if r["tmpl"][:2] in ("T1", "T2", "T4", "T5")]
        elif t == "ALL":
            rs = rows
        else:
            rs = [r for r in rows if r["tmpl"] == t]
        if not rs:
            continue
        n = len(rs)
        sch = sum(1 for r in rs if r["attempts"][0].get("schema_ok"))
        v1 = sum(1 for r in rs if r["attempts"][0].get("stage") == "ok")
        vi1 = sum(1 for r in rs if r["attempts"][0].get("stage") == "ok" and r["attempts"][0].get("intent_ok"))
        vf = sum(1 for r in rs if r["attempts"][-1].get("stage") == "ok")
        vif = sum(1 for r in rs if r["attempts"][-1].get("stage") == "ok" and r["attempts"][-1].get("intent_ok"))
        used = [0, 0, 0, 0, 0]
        for r in rs:
            if r["attempts"][-1].get("stage") == "ok":
                used[len(r["attempts"]) - 1] += 1
            else:
                used[4] += 1
        lat = [r["total_sec"] for r in rs]
        out.append(f"| {t} | {n} | {pct(sch, n)} | {pct(v1, n)} | {pct(vi1, n)} | {pct(vf, n)} | {pct(vif, n)} | {'/'.join(map(str, used))} | {q(lat, .5):.1f} | {q(lat, .95):.1f} |")
        groups[t] = dict(n=n, valid1=v1, valid_intent1=vi1, valid_final=vf, valid_intent_final=vif, p50=q(lat, .5), p95=q(lat, .95))
    if detail:
        out.append("")
        out.append("First-attempt failure reasons (normalised):")
        reasons = {}
        for r in rows:
            a = r["attempts"][0]
            if a.get("stage") != "ok":
                for e in a.get("errors", [])[:1]:
                    reasons.setdefault((r["tmpl"][:2], a.get("stage"), norm(e)), 0)
                    reasons[(r["tmpl"][:2], a.get("stage"), norm(e))] += 1
        for k, v in sorted(reasons.items(), key=lambda kv: -kv[1])[:14]:
            out.append(f"- {v}x {k[0]} [{k[1]}] {k[2]}")
        pt = [a.get("prompt_tokens") for r in rows for a in r["attempts"][:1] if a.get("prompt_tokens")]
        if pt:
            out.append(f"\nprompt tokens (first attempt): min {min(pt)}, p50 {int(q(pt, .5))}, max {max(pt)}")
        jz = [r for r in rows if r["tmpl"][:2] == "T3" and r["attempts"][-1].get("stage") == "ok"]
        if jz:
            out.append(f"jazzy (>=50% seventh/extended chords) among passing T3: {sum(1 for r in jz if r['attempts'][-1].get('jazzy'))}/{len(jz)}")
        gm = [r["gpu_mem_mib"] for r in rows if r.get("gpu_mem_mib")]
        if gm:
            out.append(f"card memory in use at plan start (MiB): min {min(gm)}, max {max(gm)}")
    return "\n".join(out), groups


if __name__ == "__main__":
    for t in sys.argv[1:]:
        print(summarize(t)[0]); print()
