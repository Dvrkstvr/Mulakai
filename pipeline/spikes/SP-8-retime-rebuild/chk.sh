python3 - <<'PY'
import re,difflib
for s in ["ellies","purple","eventide","B_d"]:
    def seq(v):
        t=open(f"/home/calvin/sp8/{s}/v_{v}_ch/out_ch.abc").read()
        voc=t.split("V: Ins")[0] if False else t
        c=re.findall(r'"([^"]+)"',t); out=[]
        for x in c:
            if not out or out[-1]!=x: out.append(x)
        return out
    b=seq("base")
    for v in ["half","double","bpm_mean","bpm_x2_3","bpm_round"]:
        o=seq(v); r=difflib.SequenceMatcher(None,b,o).ratio()
        print(s,v,"distinct-run chords",len(o),"vs",len(b),"seq similarity",round(r,2))
PY
grep -c '^% ' ~/sp8/B_d/v_half_ch/out_ch.abc; grep '^% ' ~/sp8/B_d/v_half_ch/out_ch.abc | tr '\n' ' '; echo; grep '^% ' ~/sp8/B_d/v_base_ch/out_ch.abc | tr '\n' ' '
