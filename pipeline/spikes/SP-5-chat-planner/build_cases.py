"""Builds cases.json: the 40 scripted conversations (36 single-turn + 4 multi-turn runs of 3-4 turns) with expected actions and checks,
and verifies every scripted fixture (teacher-forcing replies) against yue-server apply. Throwaway."""
from __future__ import annotations

import json
import os

import songs

HERE = os.path.dirname(os.path.abspath(__file__))
PC = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']
NAT = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}


def pc_of(root):
    return (NAT[root[0]] + (1 if root.endswith('#') else -1 if root.endswith('b') else 0)) % 12


def reharm_ops(song, a, b, shift=5):
    """A real substitution: every bar's chord root moved up `shift` semitones, seventh/ninth qualities (fixture for teacher forcing)."""
    qual = ['maj7', 'm7', '7', 'm7']
    old = {}
    for line in song['facts']['bar_map']:
        parts = line.split(':', 1)
        if parts[0].isdigit():
            chord = parts[1].split('|')[0].strip()
            if chord and chord != '-':
                tok = chord.split()[0].split('@')[0]
                root = tok[:2] if len(tok) > 1 and tok[1] in '#b' else tok[:1]
                old[int(parts[0])] = root
    key_root = song['facts']['header']['key'].rstrip('m')
    chords = []
    for n, bar in enumerate(range(a, b + 1)):
        root = PC[(pc_of(old.get(bar, key_root)) + shift) % 12]
        chords.append({'bar': bar, 'beat': 1, 'root': root, 'quality': qual[n % 4]})
    return [{'op': 'REHARMONIZE', 'from_bar': a, 'to_bar': b, 'chords': chords}]


def recipe_fx(title, style, bpm, key, ts, lang, structure, lyrics, msg, assumptions):
    return {'action': 'recipe', 'message': msg, 'assumptions': assumptions,
            'recipe': {'title': title, 'style': style, 'bpm': bpm, 'key': key, 'time_signature': ts, 'language': lang, 'engine': 'yue2',
                       'structure': structure, 'lyrics': [{'tag': t, 'lines': ls} for t, ls in lyrics]}}


def main():
    S = songs.load()
    T = lambda id, user, expect, **kw: {'id': id, 'user': user, 'expect': expect, **kw}  # noqa: E731
    cases = []

    def single(cid, group, song, user, expect, **kw):
        cases.append({'id': cid, 'group': group, 'song': song, 'turns': [T(cid + '.t1', user, expect, **kw)]})

    # ---- 10 recipes: 4 en, 3 de, 3 es; 3 vague
    R = lambda lang, **k: {'action': 'recipe', 'lang': lang, **k}  # noqa: E731
    single('RC01', 'recipe', None, "An upbeat English indie-pop song about a road trip with friends, jangly guitars and a female singer", R('en'))
    single('RC02', 'recipe', None, "a dark synthwave track about driving through a city at night, male vocals, around 110 bpm", R('en', bpm=[95, 125], style_has=['synth']))
    single('RC03', 'recipe', None, "a gentle acoustic folk song about my grandmother's garden", R('en', style_has=['acoustic']))
    single('RC04', 'recipe', None, "something sad", R('en', vague=True, must_propose=True))
    single('RC05', 'recipe', None, "Schreib mir einen langsamen deutschen Popsong über den Abschied, mit Klavier und weicher Frauenstimme", R('de', bpm=[40, 100], style_has=['piano|klavier']))
    single('RC06', 'recipe', None, "Ein fröhlicher Schlager über den Sommer am See", R('de'))
    single('RC07', 'recipe', None, "irgendwas Ruhiges zum Einschlafen", R('de', vague=True, must_propose=True, bpm=[40, 95]))
    single('RC08', 'recipe', None, "una balada lenta sobre el mar, guitarra de nailon y una voz femenina suave", R('es', bpm=[40, 100], style_has=['guitar']))
    single('RC09', 'recipe', None, "A fast reggaeton party song in Spanish about a summer night out", R('es', bpm=[85, 130], style_has=['reggaeton']))
    single('RC10', 'recipe', None, "algo romántico para mi novia", R('es', vague=True, must_propose=True))

    # ---- 6 ask-or-propose
    single('AK01', 'ask', None, "make it better", {'action': 'ask', 'stuck': True})
    single('AK02', 'ask', None, "yes, do that", {'action': 'ask', 'stuck': True})
    single('AK03', 'ask', None, "make it like that one", {'action': 'ask', 'stuck': True})
    single('NM01', 'near-miss', None, "something for my mom's birthday", R('en', must_propose=True))
    single('NM02', 'near-miss', 'S3', "make the chorus hit harder", {'action': 'edit', 'must_propose': True, 'edit': {'any': True}})
    single('NM03', 'near-miss', 'S2', "the verses feel too busy to me", {'action': 'edit', 'must_propose': True, 'edit': {'any': True}})

    # ---- 10 single edit turns
    s3, s4, s2, s1, s5 = S['S3'], S['S4'], S['S2'], S['S1'], S['S5']
    sec = lambda s, i: s['facts']['sections'][i - 1]  # noqa: E731
    E = lambda **k: {'action': 'edit', **k}  # noqa: E731
    single('ED01', 'edit', 'S3', "give the chorus jazz chords", E(must_propose=True, assumes=True, edit={'kind': 'reharm', 'bars': [47, 62], 'tol': 0, 'cover': 0.5}))
    single('ED02', 'edit', 'S4', "change the words of the second chorus, make them more hopeful", E(must_propose=True, edit={'kind': 'lyrics', 'block': 5, 'lang': 'de'}))
    single('ED03', 'edit', 'S2', "slow it down a little", E(must_propose=True, edit={'kind': 'tempo', 'bpm': [70, 91]}))
    single('ED04', 'edit', 'S1', "put it in a different key", E(must_propose=True, edit={'kind': 'transpose'}))
    single('ED05', 'edit', 'S5', "make it sound more like a rock band", E(must_propose=True, edit={'kind': 'style', 'style_has': ['rock']}))
    single('ED06', 'edit', 'S3', "make this part jazzier",
           E(marked=True, edit={'kind': 'reharm', 'bars': [11, 18], 'tol': 2, 'cover': 0.5}),
           mark="bars 11-18, inside S2 verse (bars 11-46); key Dm, 87 bpm there")
    lines4 = songs.lyric_blocks_text(s4['lyrics'])[3][1]
    single('ED07', 'edit', 'S4', "this line should rhyme with the one before it",
           E(marked=True, edit={'kind': 'lyrics', 'block': 4, 'lang': 'de'}),
           mark=f"lyric line 3 of block 4 ([Verse 2] #2, bars 27-35 area): \"{lines4[2]}\"")
    single('ED08', 'edit', 'S5', "repeat this",
           E(marked=True, edit={'kind': 'repeat', 'section': 6}),
           mark="bars 70-77, S6 chorus (the second chorus); key Am, 138 bpm there")
    single('ED09', 'edit', 'S2', "repeat the bridge", {'action': 'say', 'alt': ['ask'], 'nonexistent': True})
    single('ED10', 'edit', 'S1', "give the second chorus a jazzier feel", E(must_propose=True, assumes=True, edit={'kind': 'reharm', 'bars': [167, 206], 'tol': 0, 'cover': 0.5}))
    # ---- 4 say
    single('SY01', 'say', 'S2', "what key is this song in?", {'action': 'say', 'contains': r"\bG\s?m\b|G minor|g-moll|sol menor"})
    single('SY02', 'say', 'S4', "how many choruses does it have?", {'action': 'say', 'contains': r"\b(3|three|drei|tres)\b"})
    single('SY03', 'say', 'S5', "how long is the song?", {'action': 'say', 'contains': r"3[:.,]?\s?[345]|3\s*min|214|three"})
    single('SY04', 'say', None, "what can you do for me here?", {'action': 'say'})
    # ---- 4 scalpel
    single('SC01', 'scalpel', 'S3', "repaint the chorus with new words about the rain", {'action': 'scalpel', 'kind': 'repaint'})
    single('SC02', 'scalpel', 'S4', "add a string quartet layer under the second verse", {'action': 'scalpel', 'kind': 'add_layer'})
    single('SC03', 'scalpel', 'S5', "split it into stems, I want the vocals on their own", {'action': 'scalpel', 'kind': 'split'})
    single('SC04', 'scalpel', 'S2', "export it as a wav file", {'action': 'scalpel', 'kind': 'export'})
    # ---- 2 analyze
    single('AN01', 'analyze', None, "make a song like this one but in German and about leaving", {'action': 'analyze'},
           attachment='audio file "demo_take3.wav", 2:41, not read yet')
    single('AN02', 'analyze', None, "something like my Purple Shinings but sadder, and in Spanish", {'action': 'analyze'})

    # ---- 4 multi-turn runs
    r1_1 = recipe_fx("Open Road Summer", "indie pop, jangly electric guitars, bright drums, female vocal, upbeat, road trip", 118, 'G', '4/4', 'en',
                     ['Intro', 'Verse', 'Chorus', 'Verse', 'Chorus', 'Outro'],
                     [('Verse', ["Windows down on the morning highway", "Four of us and a map we never read", "Coffee cups and a borrowed playlist", "Every mile is a song instead"]),
                      ('Chorus', ["Take me down the open road", "Sing it loud, we'll never slow", "Wherever the sunlight goes", "That's the only way we know"]),
                      ('Verse', ["Gas station stars and a midnight diner", "Someone's asleep on a stranger's coat", "Counting towns that we'll soon be leaving", "Laughing at jokes that we all know by heart"]),
                      ('Chorus', ["Take me down the open road", "Sing it loud, we'll never slow", "Wherever the sunlight goes", "That's the only way we know"])],
                     "An upbeat indie-pop road-trip song for four friends.", ["assuming 4/4 and G major", "assuming about 3 minutes"])
    r1_2 = recipe_fx("Open Road Summer", "indie pop, jangly electric guitars, bright drums, female vocal, upbeat, road trip", 132, 'G', '4/4', 'en',
                     ['Intro', 'Verse', 'Chorus', 'Verse', 'Chorus', 'Bridge', 'Chorus', 'Outro'],
                     [('Verse', ["Windows down on the morning highway", "Four of us and a map we never read", "Coffee cups and a borrowed playlist", "Every mile is a song instead"]),
                      ('Chorus', ["Take me down the open road", "Sing it loud, we'll never slow", "Wherever the sunlight goes", "That's the only way we know"]),
                      ('Verse', ["Gas station stars and a midnight diner", "Someone's asleep on a stranger's coat", "Counting towns that we'll soon be leaving", "Laughing at jokes that we all know by heart"]),
                      ('Chorus', ["Take me down the open road", "Sing it loud, we'll never slow", "Wherever the sunlight goes", "That's the only way we know"]),
                      ('Bridge', ["And if the engine dies tonight", "We'll sit and watch the dawn arrive", "Nothing here is lost or wrong", "Just a little more of the song"]),
                      ('Chorus', ["Take me down the open road", "Sing it loud, we'll never slow", "Wherever the sunlight goes", "That's the only way we know"])],
                     "Faster (132 bpm) and with a bridge before the last chorus.", ["assuming the bridge goes before the last chorus"])
    cases.append({'id': 'MT01', 'group': 'multi', 'song': None, 'turns': [
        T('MT01.t1', "an upbeat English indie-pop song about a road trip with friends", R('en'), fixture=r1_1),
        T('MT01.t2', "make it faster and add a bridge", {'action': 'recipe', 'lang': 'en', 'refine': {'bpm_above_pending': True, 'structure_has': 'Bridge', 'has_bridge_lyrics': True}}, fixture=r1_2),
        T('MT01.t3', "what key is it in?", {'action': 'say', 'says_pending_key': True}),
    ]})

    fix_cho = reharm_ops(s4, 15, 22)
    fix_cho2 = reharm_ops(s4, 36, 43)
    cases.append({'id': 'MT02', 'group': 'multi', 'song': 'S4', 'turns': [
        T('MT02.t1', "give the chorus jazz chords", E(must_propose=True, assumes=True, edit={'kind': 'reharm', 'one_of': [[15, 22], [36, 43], [53, 60]], 'cover': 0.5}),
          fixture={'action': 'edit', 'message': "Jazz chords for the first chorus.", 'assumptions': ["assuming the first chorus, bars 15-22"], 'ops': fix_cho}),
        T('MT02.t2', "no, the second chorus", E(edit={'kind': 'reharm', 'bars': [36, 43], 'tol': 0, 'cover': 0.5}), commit=True,
          fixture={'action': 'edit', 'message': "Jazz chords for the second chorus instead.", 'assumptions': ["the second chorus is bars 36-43"], 'ops': fix_cho2}),
        T('MT02.t3', "now slow it down a bit", E(edit={'kind': 'tempo', 'bpm': [60, 83]}),
          fixture={'action': 'edit', 'message': "Slowed to 76 bpm.", 'assumptions': ["a bit = about 10% slower"], 'ops': [{'op': 'SET_TEMPO', 'bpm': 76}]}),
    ]})

    ex = ["Mañana el sol saldrá sin ti", "y yo aprenderé a esperar", "cada herida es una puerta", "que me enseña a caminar", "Hoy te dejo ir sin miedo", "con el corazón en paz", "porque lo que fue verdadero", "volverá a florecer"]
    cases.append({'id': 'MT03', 'group': 'multi', 'song': 'S2', 'turns': [
        T('MT03.t1', "make the words of the second chorus more hopeful", E(assumes=True, edit={'kind': 'lyrics', 'block': 6, 'lang': 'es'}), commit=True,
          fixture={'action': 'edit', 'message': "A hopeful second chorus.", 'assumptions': ["the second chorus is lyric block 6"],
                   'ops': [{'op': 'REWRITE_LYRICS', 'block': 6, 'tag': '[Chorus]', 'occurrence': 2, 'lines': ex}]}),
        T('MT03.t2', "now put the whole song down a tone", E(edit={'kind': 'transpose', 'semitones': -2}), commit=True,
          fixture={'action': 'edit', 'message': "Down a whole tone.", 'assumptions': [], 'ops': [{'op': 'TRANSPOSE', 'semitones': -2}]}),
        T('MT03.t3', "what key is it in now?", {'action': 'say', 'says_current_key': True}),
    ]})

    r4_1 = recipe_fx("Luz sobre el mar", "slow Spanish ballad, nylon guitar, soft female vocal, intimate", 68, 'Am', '4/4', 'es',
                     ['Intro', 'Verse', 'Chorus', 'Verse', 'Chorus', 'Outro'],
                     [('Verse', ["La sal en tu piel, el viento sin nombre", "tu barca se aleja y yo no me muevo", "el mar me devuelve lo que no dije", "y todo lo quieto se vuelve eterno"]),
                      ('Chorus', ["Luz sobre el mar, no te vayas aún", "deja que el alba me hable de ti", "luz sobre el mar, guárdame el azul", "hasta que vuelvas a mí"]),
                      ('Verse', ["Cuento las olas que llegan sin prisa", "cada una trae un pedazo de ayer", "la arena guarda tu huella pequeña", "y yo la sigo sin querer volver"]),
                      ('Chorus', ["Luz sobre el mar, no te vayas aún", "deja que el alba me hable de ti", "luz sobre el mar, guárdame el azul", "hasta que vuelvas a mí"])],
                     "Una balada lenta sobre el mar, con guitarra de nailon.", ["suponiendo 4/4 y La menor", "suponiendo unos 3 minutos"])
    r4_2 = recipe_fx("Stadtlicht", "fast German rock, distorted electric guitars, driving drums, raw male vocal, energetic", 148, 'Em', '4/4', 'de',
                     ['Intro', 'Verse', 'Chorus', 'Verse', 'Chorus', 'Outro'],
                     [('Verse', ["Neonlicht auf nassem Asphalt", "die Nacht hat nie Feierabend", "wir rennen durch die Straßen", "und keiner fragt wohin"]),
                      ('Chorus', ["Stadtlicht, brenn für mich", "Stadtlicht, ich seh dich", "wir sind laut und wir sind jung", "die Stadt gehört uns jetzt"]),
                      ('Verse', ["Hinterhöfe, Bässe, Rauch", "ein Lied aus jedem Fenster", "heute zählt nur dieser Moment", "morgen ist noch weit"]),
                      ('Chorus', ["Stadtlicht, brenn für mich", "Stadtlicht, ich seh dich", "wir sind laut und wir sind jung", "die Stadt gehört uns jetzt"])],
                     "Ein schneller Deutschrock über die Stadt.", ["angenommen 4/4 und E-Moll"])
    cases.append({'id': 'MT04', 'group': 'multi', 'song': None, 'turns': [
        T('MT04.t1', "una balada lenta sobre el mar, con guitarra de nailon", R('es', bpm=[40, 100]), fixture=r4_1),
        T('MT04.t2', "hmm, no, I'd rather have a fast German rock song about the city", {'action': 'recipe', 'lang': 'de', 'bpm': [110, 200], 'style_has': ['rock']}, fixture=r4_2),
        T('MT04.t3', "what's the tempo?", {'action': 'say', 'says_pending_bpm': True}),
        T('MT04.t4', "ok, go back to the first idea, the sea ballad", {'action': 'recipe', 'lang': 'es', 'bpm': [40, 100]}),
    ]})

    # verify the edit fixtures apply (teacher-forcing must itself be valid)
    chk = [('S4', fix_cho), ('S4', fix_cho2)]
    for k, ops in chk:
        res, err = songs.apply_ops(S[k], ops)
        assert res and res['ok'], (k, err, res and (res['verdicts'], res['checks']))
    s4v2 = songs.commit(S['S4'], fix_cho2, 'chorus 2 jazz chords')
    res, err = songs.apply_ops(s4v2, [{'op': 'SET_TEMPO', 'bpm': 76}])
    assert res and res['ok'], (err, res)
    res, err = songs.apply_ops(S['S2'], [{'op': 'REWRITE_LYRICS', 'block': 6, 'tag': '[Chorus]', 'occurrence': 2, 'lines': ex}])
    assert res and res['ok'], (err, res and (res['verdicts'], res['checks']))
    s2v2 = songs.commit(S['S2'], [{'op': 'REWRITE_LYRICS', 'block': 6, 'tag': '[Chorus]', 'occurrence': 2, 'lines': ex}], 'hopeful chorus 2')
    res, err = songs.apply_ops(s2v2, [{'op': 'TRANSPOSE', 'semitones': -2}])
    assert res and res['ok'], (err, res and (res['verdicts'], res['checks']))

    n_single = sum(1 for c in cases if c['group'] != 'multi')
    n_turns = sum(len(c['turns']) for c in cases)
    must = sum(1 for c in cases if c['group'] != 'multi' and c['turns'][0]['expect'].get('must_propose'))
    print('conversations', len(cases), 'single', n_single, 'multi', len(cases) - n_single, 'turns', n_turns, 'must-propose', must)
    json.dump(cases, open(os.path.join(HERE, 'cases.json'), 'w', encoding='utf8'), ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
