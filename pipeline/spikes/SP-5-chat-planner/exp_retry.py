"""Experiment: the retry's closing line. Current: "Return a corrected, complete reply as compact JSON only." vs + "Keep only the ops the person asked for." (ED06 marked 'jazzier', 3 seeds). Throwaway."""
import json, sys, time
sys.path.insert(0, r"E:\ai\tmp\sp5\site")
import run, songs, prompt as P, schemas as S, llm
Sg = songs.load()
P.V3 = P.V31 = P.RLE = True
orig = P.retry_messages
def patched(messages, reply, reasons):
    fb = "Your reply was rejected:\n" + '\n'.join(f"- {r}" for r in reasons) + "\nReturn a corrected, complete reply as compact JSON only. Keep only the ops the person asked for: drop any op for something they did not ask."
    return messages + [{'role': 'assistant', 'content': reply}, {'role': 'user', 'content': fb}]
song = Sg['S3']
text = "make this part jazzier"
for name, fn in (('current', orig), ('keep-only', patched)):
    P.retry_messages = fn
    run.P.retry_messages = fn
    for sd in (31, 32, 33):
        st = {'song': song, 'library': songs.LIBRARY_TITLES, 'pending': None, 'history': [], 'mark': "bars 11-18, inside S2 verse (bars 11-46); key Dm, 87 bpm there", 'attachment': None}
        msgs = P.build_messages(st, text, rules=P.rules_for())
        sch = S.turn_schema(song['facts'], 4)
        t0 = time.time()
        attempts, reply, acc, _ = run.call_loop(msgs, sch, song, sd)
        print(name, sd, 'accepted', acc, 'attempts', len(attempts), 'wall', round(time.time() - t0, 1), [(o['op']) for o in (reply or {}).get('ops', [])], flush=True)
        llm.release()
