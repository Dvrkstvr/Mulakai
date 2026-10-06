"""SP-5 turn prompt: system rules for the closed action set (+ the SCORE planner's op reference) and one user message made of
the song-state block, the pending proposal, the last 4 turns, the mark/attachment and the request. Pure. Throwaway."""
from __future__ import annotations

import json
import os

import schemas as S

HERE = os.path.dirname(os.path.abspath(__file__))
_rules = open(os.path.join(HERE, "planner_rules.txt"), encoding="utf8").read()
# The planner's first paragraph says "answer with ONE JSON object {ops}"; in a chat turn the ops live inside an edit reply.
OPS_REFERENCE = _rules[_rules.index("Ops (bars are numbered"):]

INTRO = """You are the assistant of Mulakai, a local song studio. The person talks a song into being. You propose, code checks your proposal, and nothing runs until the person presses the card's button, so propose boldly. Every turn you answer with ONE JSON object {"action": ...} and nothing else, in the person's language for message and assumptions."""

ACTION_TEXT = {
    'recipe': """- recipe: the person describes a NEW song, or refines or changes the new-song proposal that is still pending. Fill EVERY field of the recipe card, even when the description is thin: invent what is missing and list each guess in assumptions (for example "assuming 4/4 and A minor"). A refinement ("faster", "add a bridge", "in Spanish") is answered with the COMPLETE updated recipe, changing only what was asked; lyrics are rewritten only when the language, topic or structure changes.""",
    'edit': """- edit: the person wants to change THIS song (a SONG block is given): chords, the words of a section, tempo, key, style, repeat or cut a section, an instrument phrase. Answer with ops, as the OPS REFERENCE below says. State the place you assumed in assumptions ("assuming the first chorus, bars 25-32"). When the person says "this" and a MARK is given, the mark is the place. A follow-up edit while an edit card is pending replaces that card: send the complete op list.""",
    'scalpel': """- scalpel: a precise job for a dedicated tool, not a score edit: kind repaint (sing one section again, with new words or in a new way, as audio), add_layer (add an instrument or voice as a new layer), split (separate the song into stems), export (save the song as a file). target says where (a section, or "whole song"); details the instrument or the words asked for.""",
    'analyze': """- analyze: the person wants a REFERENCE song read first (an ATTACHED audio file, or a song named in LIBRARY): "like this one, but ...". reference names it; plan says what you will propose after reading it.""",
    'say': """- say: a question about the song, the pending card or how Mulakai works. Answer in 1-3 sentences from the SONG block and the card. Nothing changes.""",
    'ask': """- ask: ONLY when you cannot propose anything: there is nothing to act on and the conversation gives no hint. One short question with 2-4 choices. If you can make a sensible guess, do that instead: propose, and state the guess in assumptions.""",
}

RECIPE_FIELDS = f"""RECIPE FIELDS: title (short); style: comma-separated genre, instruments, mood and voice (no tempo or key: they have their own fields); bpm {S.BPM_MIN}-{S.BPM_MAX}; key from the list; time_signature; language: the language the lyrics are sung in; engine: "yue2" unless the person asks for what only ACE-Step does (an exact duration, a reference voice); structure: the ordered section tags, only from {', '.join(S.TAGS)} (a typical song: Intro, Verse, Chorus, Verse, Chorus, Bridge, Chorus, Outro); lyrics: one entry per SUNG section, in song order, with its tag (Verse, Pre-Chorus, Chorus, Bridge or Outro; an Intro is instrumental and has no lyrics) and {S.LINES_MIN} to {S.LINES_MAX} lines. Write real singable lines in the LANGUAGE OF THE REQUEST (a German request gets German lyrics, "a Spanish ballad" Spanish lyrics; when the person names a language for the words, that one), matching title and style; no tags or brackets inside lines; a chorus repeats its idea, not a line more than twice."""

RECIPE_FIELDS_NOLYR = RECIPE_FIELDS.split('; lyrics:')[0] + '. The lyrics are written in a second step: do not write them.'

OPS_BLOCK = f"""OPS REFERENCE (for action edit; the ops go in the reply's "ops" list, 1-6 ops):
{OPS_REFERENCE}"""


TEXT_ORDER = ['recipe', 'edit', 'scalpel', 'analyze', 'say', 'ask']


def rules_for(allowed=None, with_lyrics=True):
    """The system prompt for the allowed actions (default: all six). Only an allowed edit brings the op reference; only recipe brings the fields."""
    allowed = allowed or S.ACTIONS
    parts = [INTRO, "ACTIONS (exactly one per turn):" + chr(10) + chr(10).join(ACTION_TEXT[a] for a in TEXT_ORDER if a in allowed)]
    if 'recipe' in allowed:
        parts.append(RECIPE_FIELDS if with_lyrics else RECIPE_FIELDS_NOLYR)
    if 'edit' in allowed:
        parts.append(OPS_BLOCK)
    return (chr(10) * 2).join(parts)


CHAT_RULES = rules_for()

# Rung 1 of the ladder: the router's system prompt (one enum) and the short per-action prompts live in ladder.py.


def mark_line(mark):
    return f'MARK (what "this" means; the person marked it): {mark}' if mark else None


def fmt_recipe(r):
    lyrics = '\n'.join(f"[{sec['tag']}] " + ' / '.join(sec['lines']) for sec in r.get('lyrics', []))
    return (f"title: {r['title']}\nstyle: {r['style']}\nbpm {r['bpm']} · key {r['key']} · time {r['time_signature']} · language {r['language']} · "
            f"engine {r['engine']}\nstructure: {', '.join(r['structure'])}\nlyrics:\n{lyrics}")


def fmt_pending(p):
    if not p:
        return None
    if p['kind'] == 'recipe':
        return "PENDING PROPOSAL (the new-song card the person is looking at; nothing has run):\n" + fmt_recipe(p['recipe'])
    return (f"PENDING PROPOSAL (the edit card against {p['against']}; nothing is applied yet):\n"
            + json.dumps({'ops': p['ops']}, ensure_ascii=False, separators=(',', ':')))


def fmt_history(history):
    """history: list of (who, text) already cut to the last 4 turns (a turn = person + assistant)."""
    if not history:
        return None
    return "CONVERSATION (latest last):\n" + '\n'.join(f"{'PERSON' if w == 'user' else 'ASSISTANT'}: {t}" for w, t in history)


def song_block(song, library, bar_map=True):
    lib = f"LIBRARY (song titles): {'; '.join(library)}"
    if not song:
        return lib + "\nSONG: none yet (this thread is a draft; nothing has been created)"
    f = song['facts']
    h = f['header']
    sections = '\n'.join(f"S{x['index']} {x['label']}: bars {x['from_bar']}-{x['to_bar']}" for x in f['sections'])
    blocks = '\n'.join(f"{b['index']}: {b['tag']} #{b['occurrence']}, {b['lines']} lines" + (f", first line: {b['first_line']}" if b.get('first_line') else '')
                       for b in f['lyric_blocks'])
    return '\n'.join([
        lib,
        f"SONG: \"{song['title']}\" · active {song['versions'][-1].split(' ')[0]} of {len(song['versions'])} · engine YuE2 (score-editable)",
        "VERSIONS: " + ' · '.join(song['versions']),
        f"HEADER: M:{h['meter']} L:{h['unit']} Q:1/4={h['bpm']} K:{h['key']}; {h['bars']} bars, about {round(h['seconds'])} s (the hard limit is 360 s)",
        f"KEY NOTES ({h['key']}; the key signature already applies the sharps/flats): {f['key_notes']}",
        f"STYLE: {song['style']}",
        '',
        f"SECTIONS:\n{sections or '(none marked)'}",
        '',
        f"LYRIC BLOCKS (block: tag #occurrence):\n{blocks or '(none)'}",
        *(['', "BAR MAP (bar: chords@beat | vocal | number of Ins notes):\n" + '\n'.join(f['bar_map'])] if bar_map else []),
    ])


def phrase_lines(facts, n):
    import re
    runs = []
    for line in facts['bar_map']:
        m = re.match(r'^(\d+): .*\| V:(rest|sung) \|', line)
        if not m or m.group(2) != 'rest':
            continue
        bar = int(m.group(1))
        if runs and runs[-1][1] == bar - 1:
            runs[-1][1] = bar
        else:
            runs.append([bar, bar])
    free = [f"{a}-{b}" if a != b else str(a) for a, b in runs if b - a + 1 >= n]
    return [f"PHRASE LENGTH: a WRITE_PHRASE op has exactly {n} bars",
            f"FREE BARS (the Vocal rests {n} or more bars in a row; a phrase goes only here): " + (', '.join(free) if free else f"none, no {n} bars in a row are free")]


def phrase_bars_of(request):
    import re
    words = {'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5, 'six': 6, 'seven': 7, 'eight': 8}
    cnt = r"(\d+|" + '|'.join(words) + ")"
    noun = r"(?:phrase|line|solo|riff|lick|fill|melody|motif|hook|break)"
    m = (re.search(rf"\b{cnt}[- ]?bars?\b(?:[\s-]+[\w-]+){{0,3}}?[\s-]+{noun}", request, re.I)
         or re.search(rf"\b{noun}\b(?:[\s-]+[\w-]+){{0,3}}?[\s-]+{cnt}[- ]?bars?\b", request, re.I))
    if not m:
        return 4
    w = m.group(1).lower()
    n = words.get(w) or int(w)
    return min(max(n, 1), 8)


def build_messages(state, request, rules=CHAT_RULES, reply_line='Reply with the JSON object only.', bar_map=True):
    """state: {song, library, pending, history (last-4-turn list), mark, attachment}."""
    song = state.get('song')
    parts = [song_block(song, state['library'], bar_map)]
    if song and bar_map:
        parts += phrase_lines(song['facts'], phrase_bars_of(request))
    parts.append('')
    for x in (fmt_pending(state.get('pending')), fmt_history(state.get('history'))):
        if x:
            parts += [x, '']
    if state.get('attachment'):
        parts.append(f"ATTACHED: {state['attachment']}")
    if state.get('mark'):
        parts.append(mark_line(state['mark']))
    parts += [f"REQUEST: {request}", reply_line]
    return [{'role': 'system', 'content': rules}, {'role': 'user', 'content': '\n'.join(parts)}]


def retry_messages(messages, reply, reasons):
    fb = "Your reply was rejected:\n" + '\n'.join(f"- {r}" for r in reasons) + "\nReturn a corrected, complete reply as JSON only."
    return messages + [{'role': 'assistant', 'content': reply}, {'role': 'user', 'content': fb}]
