"""SP-7: builds requests.json = SP-5's RC05..RC10 recipes (title/style/bpm/structure as the planner wrote them in SP-5's final run, sp5_recipes.json)
plus 3 new German requests of other genres whose recipe fields I wrote by hand in the planner's shape. Throwaway."""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
r = json.load(open(os.path.join(HERE, 'sp5_recipes.json'), encoding='utf8'))
S5 = ['Intro', 'Verse', 'Chorus', 'Verse', 'Chorus', 'Bridge', 'Chorus', 'Outro']
new = {
    'DE08': {'request': 'Ein Indie-Pop-Song über den Herbst in der Großstadt, ein bisschen wehmütig', 'title': 'Herbst in der Stadt',
             'style': 'indie pop, dreamy synths, clean electric guitar, male vocal, wistful', 'bpm': 104, 'language': 'de', 'structure': S5},
    'DE09': {'request': 'Deutschrap über das Aufwachsen im Viertel, ehrlich und roh', 'title': 'Mein Viertel',
             'style': 'german hip hop, boom bap, dark piano loop, rap vocal, gritty', 'bpm': 92, 'language': 'de',
             'structure': ['Intro', 'Verse', 'Chorus', 'Verse', 'Chorus', 'Verse', 'Chorus', 'Outro']},
    'DE10': {'request': 'Ein Liedermacher-Lied über Heimweh, nur Gitarre und Stimme', 'title': 'Heimweh',
             'style': 'singer-songwriter, folk, acoustic guitar, warm male vocal, intimate', 'bpm': 76, 'language': 'de',
             'structure': ['Intro', 'Verse', 'Verse', 'Chorus', 'Verse', 'Chorus', 'Outro']},
}
out = {}
for k in ('RC05', 'RC06', 'RC07', 'DE08', 'DE09', 'DE10', 'RC08', 'RC09', 'RC10'):
    out[k] = r.get(k) or new[k]
json.dump(out, open(os.path.join(HERE, 'requests.json'), 'w', encoding='utf8'), ensure_ascii=False, indent=1)
print(list(out))
