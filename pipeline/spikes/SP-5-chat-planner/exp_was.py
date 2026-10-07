"""Experiment: a helper field `was` (the old chord's root at that bar, copied from the BAR MAP) in each REHARMONIZE chord, stripped before apply. Throwaway."""
import copy, json, sys
sys.path.insert(0, r"E:\ai\tmp\sp5\site")
import songs, prompt as P, schemas as S, llm
from run import edit_reasons
Sg = songs.load()
CASES = [('S3', 'give the chorus jazz chords'), ('S3', 'make the chorus hit harder'), ('S2', 'the verses feel too busy to me'), ('S4', 'give the chorus jazz chords')]
WAS_RULE = (" In every chord of a REHARMONIZE write `was` first: the old chord's root at that bar from the BAR MAP ('-' when the bar has none), then choose the new root: "
            "in at least every second bar root must differ from was.")
def patch(schema):
    sch = copy.deepcopy(schema)
    def walk(x):
        if isinstance(x, dict):
            if x.get('properties', {}).get('op', {}).get('const') == 'REHARMONIZE':
                chord = x['properties']['chords']['items']
                props = {'bar': chord['properties']['bar'], 'was': {'type': 'string', 'maxLength': 4}}
                props.update({k: v for k, v in chord['properties'].items() if k != 'bar'})
                chord['properties'] = props
                chord['required'] = ['bar', 'was', 'beat', 'root', 'quality']
            for v in x.values(): walk(v)
        elif isinstance(x, list):
            for v in x: walk(v)
    walk(sch)
    return sch
def strip(obj):
    for o in obj.get('ops', []):
        for c in o.get('chords', []) if o.get('op') == 'REHARMONIZE' else []:
            c.pop('was', None)
    return obj
rules = P.CHAT_RULES.replace('A follow-up edit while an edit card is pending', WAS_RULE.strip() + ' A follow-up edit while an edit card is pending')
ok = n = 0; toks = []
for sk, text in CASES:
    s = Sg[sk]
    st = {'song': s, 'library': songs.LIBRARY_TITLES, 'pending': None, 'history': [], 'mark': None, 'attachment': None}
    m = P.build_messages(st, text, rules=rules)
    sch = patch(S.turn_schema(s['facts'], 4))
    for sd in (11, 12, 13):
        o = llm.chat(m, sch, seed=sd, max_tokens=4000)
        toks.append(o['completion_tokens']); n += 1
        try:
            obj = strip(json.loads(o['content']))
        except Exception:
            continue
        if obj.get('action') == 'edit':
            rs, _ = edit_reasons(obj, s)
            ok += not rs
            if rs: print('   ', sk, text[:30], rs[0][:110])
print('WAS', f"first-try valid {ok}/{n}", "mean completion tokens", round(sum(toks)/len(toks)))
