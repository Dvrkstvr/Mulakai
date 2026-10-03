"""SP-3: cut before/after clips around each edit (original library audio vs the variant render) and write listen/index.html.
Run inside WSL with the sheetsage2 venv python (reuses analyze.py's alignment); needs ffmpeg."""
import html, json, os, random, subprocess, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import analyze as an  # noqa: E402

HERE = an.HERE
LIB = "/mnt/e/repos/Mulakai/server/data/audio/"
OUT = f"{HERE}/listen"
os.makedirs(OUT, exist_ok=True)
DESC = {
    "b": "REHARMONIZE: {n} bars of the first chorus get new chords ({chords}); melody and lyrics untouched.",
    "c": "SET TEMPO: Q: {q0} -> {q1} BPM (+15 %), style text changed to match.",
    "d": "REPEAT CHORUS: the first chorus is played twice in a row (lyrics block repeated too).",
    "e": "WRITE PHRASE: a 4-bar tenor saxophone phrase replaces the Ins line in a Vocal-rest section ('tenor saxophone' added to style).",
}


def clip(src, t0, t1, dst):
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-ss", f"{max(t0, 0):.2f}", "-t", f"{t1 - max(t0, 0):.2f}", "-i", src,
                    "-ac", "2", "-ar", "44100", "-codec:a", "libmp3lame", "-b:a", "128k", dst], check=True)


def times(tr, o, i0, i1):
    bars = tr.bars()
    a = max(i0 + o, 0); b = min(i1 + o, len(bars)) - 1
    return bars[a][0], bars[b][1]


def main():
    pairs = []
    for code in ("A", "B", "C"):
        ed = an.EDITS[code]
        base = an.load_score(code, "a")
        orig_tr = an.Tr(f"{code}_orig")
        orig_audio = LIB + ed["vid"] + ".wav"
        o_orig = an.best_offset(base, orig_tr, list(range(len(base.bars))))
        rf, rn = ed["reharm"]["first_bar"], ed["reharm"]["n"]
        c0 = ed["chorus0_bars"]; n_ch = c0[1] - c0[0]
        ph0, ph1 = ed["phrase"]["bars"]
        for v in ("b", "c", "d", "e"):
            name = f"{code}_{v}"
            if not os.path.exists(f"{an.SS}/{name}/result.json"):
                continue
            tr = an.Tr(name); sc = an.load_score(code, v)
            d = f"{an.REN}/{name}"
            audio = [os.path.join(d, f) for f in os.listdir(d) if f.startswith("audio.")][0]
            if v == "b":
                w_o = (rf - 2, rf + rn + 1); w_v = w_o; desc = DESC[v].format(n=rn, chords=" ".join(ed["reharm"]["new"]))
            elif v == "e":
                w_o = (ph0 - 2, ph1 + 1); w_v = w_o; desc = DESC[v]
            elif v == "c":
                w_o = (8, 20); w_v = w_o; desc = DESC[v].format(q0=ed["bpm"], q1=ed["bpm_c"])
            else:
                w_o = (c0[0] - 1, c0[1] + n_ch); w_v = (c0[0] - 1, c0[1] + n_ch); desc = DESC[v]
                w_v = (c0[0] - 1, c0[1] + n_ch)  # variant: 1 bar before, chorus, copy; original: same count of bars from the same start
            o_v = an.best_offset(sc, tr, list(range(len(sc.bars))) if v != "d" else list(range(c0[1])))
            t_o = times(orig_tr, o_orig, *w_o); t_v = times(tr, o_v, *w_v)
            fo, fv = f"{OUT}/{name}_before.mp3", f"{OUT}/{name}_after.mp3"
            clip(orig_audio, t_o[0], t_o[1], fo); clip(audio, t_v[0], t_v[1], fv)
            pairs.append({"id": name, "song": code, "variant": v, "desc": desc, "before": os.path.basename(fo), "after": os.path.basename(fv),
                          "before_s": round(t_o[1] - t_o[0], 1), "after_s": round(t_v[1] - t_v[0], 1)})
            print(name, t_o, t_v)
    json.dump(pairs, open(f"{OUT}/pairs.json", "w"), indent=1)
    rnd = random.Random(20261003)
    cards = []
    for p in pairs:
        swap = rnd.random() < 0.5
        a, b = (p["after"], p["before"]) if swap else (p["before"], p["after"])
        cards.append(f"""<section class="card" data-key="{'A=after,B=before' if swap else 'A=before,B=after'}">
<h2>{p['id']}</h2><p>{html.escape(p['desc'])}</p>
<div class="ab"><div><b>A</b><audio controls preload="none" src="{a}"></audio></div><div><b>B</b><audio controls preload="none" src="{b}"></audio></div></div>
<p>Do A and B differ in the way described?
<label><input type="radio" name="{p['id']}" value="yes"> clearly</label>
<label><input type="radio" name="{p['id']}" value="slight"> slightly</label>
<label><input type="radio" name="{p['id']}" value="no"> no</label>
<button type="button" onclick="this.nextElementSibling.hidden=false">reveal</button><span hidden> {'A=after, B=before' if swap else 'A=before, B=after'}</span></p></section>""")
    page = f"""<!doctype html><meta charset="utf-8"><title>SP-3 A/B listen</title>
<style>body{{font:15px system-ui;max-width:860px;margin:2em auto;padding:0 1em;background:#1C1D21;color:#eee}}
.card{{border:1px solid #444;padding:1em;margin:1em 0}}.ab{{display:flex;gap:2em}}audio{{display:block;margin-top:.3em}}h2{{margin:.1em 0}}
button{{margin-left:1em}}#tally{{position:sticky;top:0;background:#1C1D21;padding:.5em 0;border-bottom:1px solid #444}}</style>
<h1>SP-3 &middot; is the change audible?</h1>
<p>Each pair is the original library render vs the render from the hand-edited score (same seed). Which of A or B has the change is shuffled;
press <i>reveal</i> after you answer. Clips cover the edited bars with one or two bars of lead-in. Criterion: heard in at least 4 of 5 pairs.</p>
<div id="tally"></div>{''.join(cards)}
<script>function t(){{const r=[...document.querySelectorAll('input:checked')];const y=r.filter(x=>x.value=='yes').length,s=r.filter(x=>x.value=='slight').length,n=r.filter(x=>x.value=='no').length;
document.getElementById('tally').textContent='answered '+r.length+' of {len(pairs)}: clearly '+y+', slightly '+s+', no '+n;}}
document.addEventListener('change',t);t();</script>"""
    open(f"{OUT}/index.html", "w", encoding="utf-8").write(page)


main()
