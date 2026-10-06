"""SP-5 turn schema: one strict-JSON reply per chat turn, one action from the closed set. The edit action's `ops` is the
SCORE planner's own op schema, ported from server/src/services/score/{opSchema,phraseSchema,sectionSchema}.ts (commit 2355046).
Recipe fields follow Guided Create's rules (see FIELD RULES in RESULT.md). Throwaway."""
from __future__ import annotations

import re

ROOTS = ['C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B']
QUALITIES = ['maj', 'm', 'dim', 'aug', '7', 'maj7', 'm7', 'dim7', 'm7b5', 'sus4', 'sus2', '6', 'm6', '7sus4', 'm(maj7)']
KEYS = ['Cb', 'Gb', 'Db', 'Ab', 'Eb', 'Bb', 'F', 'C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#',
        'Abm', 'Ebm', 'Bbm', 'Fm', 'Cm', 'Gm', 'Dm', 'Am', 'Em', 'Bm', 'F#m', 'C#m', 'G#m', 'D#m', 'A#m']  # yue-server upstream KEYS
TAGS = ['Intro', 'Verse', 'Pre-Chorus', 'Chorus', 'Bridge', 'Outro']      # YUE2_CAPABILITIES.sectionTags
SUNG_TAGS = ['Verse', 'Pre-Chorus', 'Chorus', 'Bridge', 'Outro']          # an Intro is instrumental: code writes its [Intro] tag from `structure`
TIMES = ['2/4', '3/4', '4/4', '6/8']                                      # yue2.ts METER_TEXT
LANGS = ['en', 'de', 'es', 'fr', 'it', 'pt']
ENGINES = ['yue2', 'acestep']
BPM_MIN, BPM_MAX = 40, 240                                                # the op schema's SET_TEMPO range
STYLE_LIMIT = 2000                                                        # yue-server request_model.py style max_length
LINES_MIN, LINES_MAX = 4, 8                                               # bar (d)
ACTIONS = ['ask', 'recipe', 'edit', 'scalpel', 'analyze', 'say']
SCALPEL_KINDS = ['repaint', 'add_layer', 'split', 'export']
PITCH = r"^(?:z|(?:\^|_|=)?[A-Ga-g](?:,{1,2}|'{1,2})?)$"
BEATS = [0.5, 1, 1.5, 2, 3, 4]
MAX_OPS = 6


def i(lo, hi):
    return {'type': 'integer', 'minimum': lo, 'maximum': hi}


def s(lo=1, hi=300):
    return {'type': 'string', 'minLength': lo, 'maxLength': hi}


def obj(props, required=None):
    return {'type': 'object', 'additionalProperties': False, 'required': required or list(props), 'properties': props}


def arr(items, lo=0, hi=None):
    a = {'type': 'array', 'items': items, 'minItems': lo}
    if hi is not None:
        a['maxItems'] = hi
    return a


# ---- ops (ported)
def beats_per_bar(facts):
    meters = [facts['header']['meter']]
    for line in facts['bar_map']:
        m = re.search(r'M:(\d+/\d+)', line)
        if m:
            meters.append(m.group(1))
    out = []
    for m in meters:
        a, b = m.split('/')
        out.append(-(-int(a) * 4 // int(b)))
    return max(out)


def op(name, props):
    return {'type': 'object', 'additionalProperties': False, 'required': ['op', *props.keys()],
            'properties': {'op': {'enum': name} if isinstance(name, list) else {'const': name}, **props}}


def phrase_op(song_bars, n):
    note = obj({'pitch': {'type': 'string', 'pattern': PITCH}, 'beats': {'enum': BEATS}})
    return obj({'op': {'const': 'WRITE_PHRASE'}, 'start_bar': i(1, max(1, song_bars - n + 1)), 'instrument': s(1, 40),
                'bars': {'type': 'array', 'minItems': n, 'maxItems': n, 'items': arr(note, 1, 16)}})


def ops_array_schema(facts, phrase_bars=4, min_items=1):
    bars = facts['header']['bars']
    chord = obj({'bar': i(1, bars), 'beat': i(1, beats_per_bar(facts)), 'root': {'enum': ROOTS}, 'quality': {'enum': QUALITIES},
                 'bass': {'enum': ROOTS}}, required=['bar', 'beat', 'root', 'quality'])
    labels = list(dict.fromkeys(x['label'] for x in facts['sections'] if x['label'] and len(x['label']) <= 40))
    tags = list(dict.fromkeys(b['tag'] for b in facts['lyric_blocks'] if len(b['tag']) <= 60))
    occ = max([1] + [b['occurrence'] for b in facts['lyric_blocks']])
    any_of = [
        op('SET_TEMPO', {'bpm': i(40, 240)}),
        op('REHARMONIZE', {'from_bar': i(1, bars), 'to_bar': i(1, bars), 'chords': arr(chord, 1, 96)}),
        op('EDIT_STYLE', {'style': s(1, 1000)}),
        phrase_op(bars, phrase_bars),
        op('TRANSPOSE', {'semitones': i(-11, 11)}),
    ]
    if labels:
        any_of.append(op(['REPEAT', 'CUT'], {'section': i(1, len(facts['sections'])), 'label': {'enum': labels}}))
    if facts['lyric_blocks']:
        any_of.append(op('REWRITE_LYRICS', {'block': i(1, len(facts['lyric_blocks'])), 'tag': {'enum': tags}, 'occurrence': i(1, occ),
                                            'lines': arr(s(1, 200), 1, 32)}))
    return {'type': 'array', 'minItems': min_items, 'maxItems': MAX_OPS, 'items': {'anyOf': any_of}}


NO_SONG_FACTS = {'header': {'bars': 300, 'meter': '4/4'}, 'sections': [], 'lyric_blocks': [], 'bar_map': []}


# ---- recipe + the other actions
def recipe_schema(with_lyrics=True):
    section = obj({'tag': {'enum': SUNG_TAGS}, 'lines': arr(s(1, 120), LINES_MIN, LINES_MAX)})
    props = {'title': s(1, 60), 'style': s(3, 400), 'bpm': i(BPM_MIN, BPM_MAX), 'key': {'enum': KEYS},
             'time_signature': {'enum': TIMES}, 'language': {'enum': LANGS}, 'engine': {'enum': ENGINES},
             'structure': arr({'enum': TAGS}, 3, 14)}
    if with_lyrics:
        props['lyrics'] = arr(section, 1, 10)
    recipe = obj(props)
    return obj({'action': {'const': 'recipe'}, 'message': s(1, 400), 'assumptions': arr(s(1, 160), 0, 4), 'recipe': recipe})


def turn_schema(facts, phrase_bars=4, allowed=None, with_lyrics=True):
    """One reply: anyOf the allowed actions. `facts` None = no song yet (an edit then has the dummy 300-bar bounds)."""
    allowed = allowed or ACTIONS
    f = facts or NO_SONG_FACTS
    parts = {
        'ask': obj({'action': {'const': 'ask'}, 'message': s(1, 400), 'choices': arr(s(1, 80), 2, 4)}),
        'recipe': recipe_schema(with_lyrics),
        'edit': obj({'action': {'const': 'edit'}, 'message': s(1, 400), 'assumptions': arr(s(1, 160), 0, 4),
                     'ops': ops_array_schema(f, phrase_bars)}),
        'scalpel': obj({'action': {'const': 'scalpel'}, 'message': s(1, 400), 'kind': {'enum': SCALPEL_KINDS},
                        'target': s(1, 80), 'details': s(0, 300)}),
        'analyze': obj({'action': {'const': 'analyze'}, 'message': s(1, 400), 'reference': s(1, 120), 'plan': s(1, 300)}),
        'say': obj({'action': {'const': 'say'}, 'message': s(1, 600)}),
    }
    ps = [parts[a] for a in ACTIONS if a in allowed]
    return ps[0] if len(ps) == 1 else {'anyOf': ps}


def action_schema(action, facts, phrase_bars=4, with_lyrics=True):
    return turn_schema(facts, phrase_bars, [action], with_lyrics)
