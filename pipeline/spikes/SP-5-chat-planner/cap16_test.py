"""Heavy-tail experiment: ED10 / LG01.t1 (REHARMONIZE of a 40-bar chorus) with and without the 16-bar rule (flag cap16), 2 seeds each. Throwaway."""
import json, sys
sys.path.insert(0, r"E:\ai\tmp\sp5\site")
import run, songs, prompt as P, schemas as S, llm
Sg = songs.load()
res = {}
for cap in (False, True):
    P.V3 = True; P.RLE = True; P.CAP16 = cap
    for sd in (21, 22):
        st = {'song': Sg['S1'], 'library': songs.LIBRARY_TITLES, 'pending': None, 'history': [], 'mark': None, 'attachment': None}
        text = "give the second chorus a jazzier feel"
        msgs = P.build_messages(st, text, rules=P.rules_for())
        sch = S.turn_schema(Sg['S1']['facts'], 4)
        import time
        t0 = time.time()
        attempts, reply, acc, apply_s = run.call_loop(msgs, sch, Sg['S1'], sd)
        wall = time.time() - t0
        ops = [(o['op'], o.get('from_bar'), o.get('to_bar')) for o in (reply or {}).get('ops', [])]
        res[f"cap16={cap} seed={sd}"] = {'accepted': acc, 'attempts': len(attempts), 'wall': round(wall, 1), 'completion_tokens': [a['completion_tokens'] for a in attempts], 'ops': ops,
                                         'assumptions': (reply or {}).get('assumptions')}
        print(f"cap16={cap} seed={sd}", res[f"cap16={cap} seed={sd}"], flush=True)
        llm.release()
json.dump(res, open('results/cap16_test.json', 'w'), indent=1)
