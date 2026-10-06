import glob, os, sys, json
sys.path.insert(0, ".")
import score as S
T = S.T
AUD = "../../../server/data/audio/"
ok = True
for f in sorted(glob.glob(AUD + "*.abc")):
    t = open(f, encoding="utf-8").read(); v = os.path.basename(f)[:8]
    try: a = T.parse_abc(t)
    except Exception as e: print(v, "skip invalid sidecar:", e); continue
    d = S.Doc(t); t2 = d.text()
    print(v, "roundtrip text equal:", t2 == t, "parse-equal:", T.compare(a, T.parse_abc(t2))["match"], "bars", d.nbars(), "secs", [x["label"] for x in d.sections][:8])
    for n in (2, -3, 7, 5, 11, -7):
        d = S.Doc(t); S.transpose(d, n); t3 = d.text()
        try:
            b = T.parse_abc(t3)
        except Exception as e:
            print("   transpose", n, "PARSE FAIL", e); ok = False; continue
        good = all([(x[0], x[1] + n, x[2]) for x in a.voices[nm].notes] == [(x[0], x[1], x[2]) for x in b.voices[nm].notes] for nm in S.VOICES)
        print("   transpose", n, "pitches +n:", good, b.voices["Vocal"].keys[0][1], "chords", len(b.voices["Vocal"].chords), "==", len(a.voices["Vocal"].chords))
        ok &= good
print("ALL OK" if ok else "FAILURES")
