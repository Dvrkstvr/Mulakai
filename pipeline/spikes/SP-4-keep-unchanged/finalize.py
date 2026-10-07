"""SP-4: assemble results.json (per-song tables from summarize.py + cross-song numbers + verdicts). python finalize.py (stdlib)"""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import summarize as S
R = json.load(open(f"{HERE}/results.json"))
R["aggregate"] = json.load(open(f"{HERE}/results/aggregate.json"))
R["drift_of_a_full_rerender_vs_base_unedited_bars"] = json.load(open(f"{HERE}/results/drift_loudness.json"))
w = json.load(open(f"{HERE}/results/words_at_cuts.json"))
both = one = none_ = same = 0
norm = lambda x: "".join(c for c in x.lower() if c.isalnum())
for k, rows in w.items():
    for j in sorted({r["join"] for r in rows}):
        side = [r for r in rows if r["join"] == j]; n = sum(1 for r in side if r["straddles"])
        both += n == 2; one += n == 1; none_ += n == 0
        same += n == 2 and len({norm(x) for r in side for x in r["straddles"]}) == 1
R["words_at_cut_points"] = {"cut_points": both + one + none_, "no_word_straddles": none_, "word_straddles_one_side": one, "word_straddles_both_sides": both, "of_which_same_word": same}
wer = {}
for c in "ABCD":
    old, new = S.lines_of(c); A = S.ASR; g = lambda i, ref: None if i not in A else round(S.wer(ref, A[i]["text"]), 3)
    wer[c] = {"base_vs_old_lines": g(f"{c}_base", old), "control_vs_new_lines": g(f"{c}_ctrl", new), "control_vs_old_lines": g(f"{c}_ctrl", old),
              "A1_vs_new": g(f"{c}_lyrics_A1", new), "A2_vs_new": g(f"{c}_lyrics_A2", new), "A3_vs_new": g(f"{c}_lyrics_A3", new),
              "A3_bal_vs_new": g(f"{c}_lyrics_A3_bal", new), "A3_con_vs_new": g(f"{c}_lyrics_A3_con", new)}
R["whisper_wer_first_chorus"] = wer
R["listen"] = {"page": "listen/index.html", "pairs": json.load(open(f"{HERE}/listen/pairs.json")), "owed": "user's ear half of the pass bar (pairs 1-20 required, 21-28 optional)"}
R["verdicts"] = json.load(open(f"{HERE}/verdicts.json")) if os.path.exists(f"{HERE}/verdicts.json") else {}
json.dump(R, open(f"{HERE}/results.json", "w"), indent=1, default=float)
print("results.json keys:", list(R.keys()))
print(json.dumps(R["words_at_cut_points"]), json.dumps(wer))
