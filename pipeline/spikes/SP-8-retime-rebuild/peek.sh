cd ~/sp8
for v in B_d/orig.abc B_d/v_base_ch/out_ch.abc B_d/v_bpm_round_ch/out_ch.abc purple/v_double_ch/out_ch.abc; do echo "== $v"; grep -n "^M:\|^Q:\|^L:" $v | head; grep -n "^V: Vocal" -A1 $v | sed -n 1,6p | cut -c1-160; done
head -3 purple/notation/song_beats.txt; head -4 B_d/notation/song_beats.txt
python3 - <<'PY'
import statistics
for s in ["ellies","purple","eventide","B_d"]:
    rows=[l.split("\t") for l in open(f"/home/calvin/sp8/{s}/notation/song_beats.txt")]
    t=[float(r[0]) for r in rows]
    # skip lead-in
    k=1 if rows[0][2]=="1" else 0
    t=t[k:]; g=statistics.median(b-a for a,b in zip(t,t[1:]))
    dev=[x-(t[0]+i*g) for i,x in enumerate(t)]
    print(s,"gap",round(g,3),"max drift s",round(max(abs(d) for d in dev),2),"end drift",round(dev[-1],2), "gap min/max", round(min(b-a for a,b in zip(t,t[1:])),3), round(max(b-a for a,b in zip(t,t[1:])),3))
PY
