"""Prompt experiment: first-try validity of REHARMONIZE edits under prompt variants (3 seeds x 4 requests). Throwaway."""
import json, sys
sys.path.insert(0, r"E:\ai\tmp\sp5\site")
import songs, prompt as P, schemas as S, llm
from run import edit_reasons
Sg = songs.load()
CASES = [('S3', 'give the chorus jazz chords'), ('S3', 'make the chorus hit harder'), ('S2', 'the verses feel too busy to me'), ('S4', 'give the chorus jazz chords')]
EXTRA_B = (" REHARMONIZE needs NEW ROOTS, not new colours: Dm7 over a Dm does not count. In every 2 bars at least one chord must have a different root "
           "than the old chord at that bar in the BAR MAP (for example old Dm: use Gm7, Bb maj7 or A7; old Bb: use Eb7 or Gm7).")
EXTRA_E = (" REHARMONIZE rule, simply: in every SECOND bar of the op (the 2nd, 4th, 6th ...) the chord's root must differ from the old chord's root in the BAR MAP "
           "(old Dm -> Gm7 or Bb maj7; old Bb -> Eb7 or Gm7; old F -> Bb maj7 or Dm7; old C -> F maj7 or Am7; old Gm -> Cm7 or Eb maj7); the other bars may keep the root with a richer quality.")
def variant(name):
    rules = P.CHAT_RULES
    line = 'Reply with the JSON object only.'
    if 'B' in name:
        rules = rules.replace('A follow-up edit while an edit card is pending', EXTRA_B.strip() + ' A follow-up edit while an edit card is pending')
    if 'E' in name:
        rules = rules.replace('A follow-up edit while an edit card is pending', EXTRA_E.strip() + ' A follow-up edit while an edit card is pending')
    if 'C' in name:
        line += ' Write it compactly on ONE line: no newlines, no indentation.'
    return rules, line
for name in sys.argv[1:]:
    rules, line = variant(name)
    ok = n = 0; toks = []
    for sk, text in CASES:
        s = Sg[sk]
        st = {'song': s, 'library': songs.LIBRARY_TITLES, 'pending': None, 'history': [], 'mark': None, 'attachment': None}
        m = P.build_messages(st, text, rules=rules, reply_line=line)
        sch = S.turn_schema(s['facts'], 4)
        for sd in (11, 12, 13):
            o = llm.chat(m, sch, seed=sd, max_tokens=4000)
            toks.append(o['completion_tokens'])
            try:
                obj = json.loads(o['content'])
            except Exception:
                n += 1; continue
            n += 1
            if obj.get('action') == 'edit':
                rs, _ = edit_reasons(obj, s)
                ok += not rs
    print(name, f"first-try valid {ok}/{n}", "mean completion tokens", round(sum(toks)/len(toks)))
