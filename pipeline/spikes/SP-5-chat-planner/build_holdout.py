"""cases_holdout.json: 20 single-turn cases written AFTER the prompt was tuned on the 49 scripted turns (v3), with different wordings, one new
language (French) and a second nonexistent-section case. Run once, no tuning afterwards: the generalisation check. Throwaway."""
from __future__ import annotations

import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
cases = []


def single(cid, group, song, user, expect, **kw):
    cases.append({'id': cid, 'group': group, 'song': song, 'turns': [{'id': cid + '.t1', 'user': user, 'expect': expect, **kw}]})


R = lambda lang, **k: {'action': 'recipe', 'lang': lang, **k}  # noqa: E731
E = lambda **k: {'action': 'edit', **k}  # noqa: E731
single('HO01', 'recipe', None, "Quiero una canción alegre sobre el verano en la playa, con ukelele", R('es', style_has=['ukulele|ukelele']))
single('HO02', 'recipe', None, "a gritty blues-rock song about losing a job, raspy male voice", R('en', style_has=['blues']))
single('HO03', 'recipe', None, "Mach mir bitte einen düsteren Techno-Song über die Nacht in Berlin", R('de', bpm=[115, 160], style_has=['techno']))
single('HO04', 'recipe', None, "make a lullaby", R('en', vague=True, must_propose=True, bpm=[40, 90]))
single('HO05', 'recipe', None, "une chanson douce en français sur la pluie", R('fr'))
single('HO06', 'edit', 'S2', "raise the whole song by a minor third", E(edit={'kind': 'transpose', 'semitones': 3}))
single('HO07', 'edit', 'S5', "make it quicker, around 150", E(edit={'kind': 'tempo', 'bpm': [142, 158]}))
single('HO08', 'edit', 'S4', "the first verse should end more hopefully, rewrite its words", E(must_propose=True, edit={'kind': 'lyrics', 'block': 2, 'lang': 'de'}))
single('HO09', 'edit', 'S3', "cut the outro", E(edit={'kind': 'cut', 'section': 4}))
single('HO10', 'edit', 'S3', "give the bridge a sadder harmony", {'action': 'say', 'alt': ['ask'], 'nonexistent': True})
single('HO11', 'edit', 'S2', "play the first chorus again right after itself", E(edit={'kind': 'repeat', 'section': 3}))
single('HO12', 'say', 'S1', "how many bars is it?", {'action': 'say', 'contains': r"\b206\b"})
single('HO13', 'say', 'S3', "what is the style of this song?", {'action': 'say', 'contains': r"dream|trip|lo-?fi|moody|atmospheric"})
single('HO14', 'say', None, "can you make instrumental music too?", {'action': 'say'})
single('HO15', 'scalpel', 'S5', "re-sing the second verse in a darker way", {'action': 'scalpel', 'kind': 'repaint'})
single('HO16', 'scalpel', 'S1', "add a choir layer over the last chorus", {'action': 'scalpel', 'kind': 'add_layer'})
single('HO17', 'scalpel', 'S3', "save a copy as flac", {'action': 'scalpel', 'kind': 'export'})
single('HO18', 'ask', None, "change it", {'action': 'ask', 'stuck': True})
single('HO19', 'ask', None, "go on", {'action': 'ask', 'stuck': True})
single('HO20', 'analyze', None, "use this riff as the base for a song", {'action': 'analyze'}, attachment='audio file "riff_demo.mp3", 0:52, not read yet')
json.dump(cases, open(os.path.join(HERE, 'cases_holdout.json'), 'w', encoding='utf8'), ensure_ascii=False, indent=1)
print('holdout cases', len(cases))
