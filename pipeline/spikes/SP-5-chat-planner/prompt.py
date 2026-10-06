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
    'edit': """- edit: the person wants to change THIS song (a SONG block is given): chords, the words of a section, tempo, key, style, repeat or cut a section, an instrument phrase. Answer with ops, as the OPS REFERENCE below says. State the place you assumed in assumptions ("assuming the first chorus, bars 25-32"). When the person says "this" and a MARK is given, the mark is the place. A follow-up edit while an edit card is pending replaces that card: send the complete op list. REHARMONIZE needs NEW ROOTS, not new colours: Dm7 over a Dm does not count; in every 2 bars at least one chord must have a different root than the old chord at that bar in the BAR MAP (old Dm: use Gm7, Bb maj7 or A7; old Bb: use Eb7 or Gm7).""",
    'scalpel': """- scalpel: a precise job for a dedicated tool, not a score edit: kind repaint (sing one section again, with new words or in a new way, as audio), add_layer (add an instrument or voice as a new layer), split (separate the song into stems), export (save the song as a file). target says where (a section, or "whole song"); details the instrument or the words asked for.""",
    'analyze': """- analyze: the person wants a REFERENCE song read first (an ATTACHED audio file, or a song named in LIBRARY): "like this one, but ...". Only when such a file or title is really there; if the person points at something that is not there ("like that one"), that is ask. reference names it; plan says what you will propose after reading it.""",
    'say': """- say: a question about the song, the pending card or how Mulakai works. Answer in 1-3 sentences from the SONG block and the card, quoting key, tempo and counts exactly as the HEADER shows them NOW (the active version). Nothing changes.""",
    'ask': """- ask: ONLY when you cannot propose anything: there is nothing to act on and the conversation gives no hint. One short question with 2-4 choices. If you can make a sensible guess, do that instead: propose, and state the guess in assumptions.""",
}

RECIPE_FIELDS = f"""RECIPE FIELDS: title (short); style: comma-separated genre, instruments, mood and voice (no tempo or key: they have their own fields); bpm {S.BPM_MIN}-{S.BPM_MAX}; key from the list; time_signature; language: the language the lyrics are sung in; engine: "yue2" unless the person asks for what only ACE-Step does (an exact duration, a reference voice); structure: the ordered section tags, only from {', '.join(S.TAGS)} (a typical song: Intro, Verse, Chorus, Verse, Chorus, Bridge, Chorus, Outro); lyrics: one entry per SUNG section, in song order, with its tag (Verse, Pre-Chorus, Chorus, Bridge or Outro; an Intro is instrumental and has no lyrics) and {S.LINES_MIN} to {S.LINES_MAX} lines. Write real singable lines in the LANGUAGE OF THE REQUEST (a German request gets German lyrics, "a Spanish ballad" Spanish lyrics; when the person names a language for the words, that one), matching title and style; no tags or brackets inside lines; a chorus repeats its idea, not a line more than twice."""

RECIPE_FIELDS_NOLYR = RECIPE_FIELDS.split('; lyrics:')[0] + '. The lyrics are written in a second step: do not write them.'

OPS_BLOCK = f"""OPS REFERENCE (for action edit; the ops go in the reply's "ops" list, 1-6 ops):
{OPS_REFERENCE}"""


TEXT_ORDER = ['recipe', 'edit', 'scalpel', 'analyze', 'say', 'ask']


WAS_RULE = (" In each REHARMONIZE chord write `was` first: the old chord's root at that bar, copied from the BAR MAP ('-' when the bar has none); "
            "then choose root: in at least every second bar of the op it must differ from was.")


CAP16 = False   # mode flag `cap16`: one REHARMONIZE op of at most 16 bars per turn
CAP16_RULE = (' A REHARMONIZE of a section longer than 16 bars: write ONE op for its first 16 bars only and say in assumptions that the rest is left for the next request.')
V31 = False   # mode flag `v31` (on top of v3): the key in words in the HEADER, flat/sharp signs in the stored style hints
V3 = False   # mode flag `v3`: the prompt fixes found in the v2 runs (assumption examples were parroted, verse = chorus, message dumps, routing)
V3_EDITS = [
    ("(for example \"assuming 4/4 and A minor\")", "(one short phrase per real guess that names the field and the value you chose, such as the key, the bpm or the mood; never copy a phrase from these instructions)"),
    ("lyrics are rewritten only when the language, topic or structure changes.", "lyrics are rewritten only when the language, topic or structure changes. The reply's message is one or two plain sentences for the person: never repeat the card's fields or the lyrics in it."),
    ("a chorus repeats its idea, not a line more than twice.", "every verse has its own new lines, no verse shares a line with a chorus, and a chorus repeats its own idea (not a line more than twice). key: a minor key (a name ending in m) for a sad or dark song, a major key otherwise, and it must match what you say in assumptions."),
    ("an instrument phrase. Answer with ops", "an instrument phrase. Changing the key, tempo, style, chords or words of THIS song is always edit, never recipe (recipe is only for a different new song). If the person names a section, lyric block or bar that the SONG block does not list (say, a bridge the song does not have), do not substitute another place: answer say, tell what the song has instead and let them choose. When the person says \"the chorus\" or \"the verse\" and the song has several, assume the FIRST one and say so in assumptions; they will say \"the second one\" if they meant another. Answer with ops"),
    ("- ask: ONLY when you cannot propose anything: there is nothing to act on and the conversation gives no hint.", "- ask: ONLY when you cannot propose anything: there is nothing to act on and the conversation gives no hint (a bare \"yes\", \"do that\" or \"like that one\" with no PENDING PROPOSAL, no earlier turn it points back to and no ATTACHED file is ask)."),
    ("When the person says \"this\" and a MARK is given", "A REWRITE_LYRICS keeps the language of the song's own lyrics (the block's first line shows it), whatever language the request is written in. When the person says \"this\" and a MARK is given"),
    ("- scalpel: a precise job for a dedicated tool, not a score edit:", "- scalpel: a precise job for a dedicated tool, not a score edit. A request that says repaint (even \"with new words\") is scalpel; only changing the written words of a section is edit:"),
]


def _v3(text):
    for old, new in V3_EDITS:
        text = text.replace(old, new)
    return text


def rules_for(allowed=None, with_lyrics=True, was=False):
    """The system prompt for the allowed actions (default: all six). Only an allowed edit brings the op reference; only recipe brings the fields."""
    allowed = allowed or S.ACTIONS
    texts = dict(ACTION_TEXT, edit=ACTION_TEXT['edit'] + (WAS_RULE if was else ''))
    if V3:
        texts = {k: _v3(t) for k, t in texts.items()}
    if CAP16:
        texts['edit'] += CAP16_RULE
    parts = [INTRO, "ACTIONS (exactly one per turn):" + chr(10) + chr(10).join(texts[a] for a in TEXT_ORDER if a in allowed)]
    if 'recipe' in allowed:
        fields = RECIPE_FIELDS if with_lyrics else RECIPE_FIELDS_NOLYR
        parts.append(_v3(fields) if V3 else fields)
    if 'edit' in allowed:
        parts.append(OPS_BLOCK)
    return (chr(10) * 2).join(parts)


CHAT_RULES = rules_for()

# Rung 1 of the ladder: the router's system prompt (one enum) and the short per-action prompts live in ladder.py.


REPLY_LINE = 'Reply with the JSON object only, compact on ONE line (no newlines, no indentation).'


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


RLE = False   # set by the runner (mode flag `rle`): runs of identical bar-map lines become "a-b: ..." (chord-free covers)


def rle_bar_map(bar_map):
    """Runs of identical consecutive bar lines ("n: chords | V:x | I:k") collapse to "a-b: ..."; section and meter lines pass through."""
    import re
    parsed = []
    for line in bar_map:
        m = re.match(r'^(\d+): (.*)$', line)
        parsed.append((int(m.group(1)), m.group(2)) if m else (None, line))
    out, i = [], 0
    while i < len(parsed):
        n, body = parsed[i]
        if n is None:
            out.append(body)
            i += 1
            continue
        j = i
        while j + 1 < len(parsed) and parsed[j + 1][0] is not None and parsed[j + 1][1] == body and parsed[j + 1][0] == parsed[j][0] + 1:
            j += 1
        out.append(f"{n}: {body}" if j == i else f"{n}-{parsed[j][0]}: {body}")
        i = j + 1
    return out


def key_words(key):
    """v3.1: the ABC key name in words, "Fm" -> " (F minor)": a 14B model read K:Fm as the old key after a TRANSPOSE (MT03.t3 said Gm twice)."""
    root = key[:-1] if key.endswith('m') else key
    return f" ({root} {'minor' if key.endswith('m') else 'major'})"


def clean_style(style):
    """v3: the app appends its own tempo / key / meter hints to a style (", 176 bpm, D major, 6/8 time"); YuE2 does not obey them, so the stored
    text can contradict the score (Gertar: style 176 bpm D major 6/8, score 85 bpm Dm 4/4). The state block shows the style without them."""
    import re
    keep = [seg for seg in style.split(', ')
            if not re.fullmatch(r'\s*\d+\s*bpm\s*', seg) and not re.fullmatch(r'\s*[A-G][#b' + (chr(0x266d) + chr(0x266f) if V31 else '') + r']?\s*(major|minor|m)?\s*', seg) and not re.fullmatch(r'\s*\d+/\d+\s*time\s*', seg)]
    return ', '.join(keep)


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
        f"HEADER: M:{h['meter']} L:{h['unit']} Q:1/4={h['bpm']} K:{h['key']}{key_words(h['key']) if V31 else ''}; {h['bars']} bars, about {round(h['seconds'])} s (the hard limit is 360 s)",
        f"KEY NOTES ({h['key']}; the key signature already applies the sharps/flats): {f['key_notes']}",
        f"STYLE (a description only; its bpm or key words may be stale, the HEADER is true): {clean_style(song['style']) if V3 else song['style']}",
        '',
        f"SECTIONS:\n{sections or '(none marked)'}",
        '',
        f"LYRIC BLOCKS (block: tag #occurrence):\n{blocks or '(none)'}",
        *(['', "BAR MAP (bar: chords@beat | vocal | number of Ins notes" + ('; "a-b:" = the same for every bar a to b' if RLE else '') + "):\n"
           + '\n'.join(rle_bar_map(f['bar_map']) if RLE else f['bar_map'])] if bar_map else []),
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


def build_messages(state, request, rules=CHAT_RULES, reply_line=REPLY_LINE, bar_map=True):
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
    fb = "Your reply was rejected:\n" + '\n'.join(f"- {r}" for r in reasons) + "\nReturn a corrected, complete reply as compact JSON only."
    return messages + [{'role': 'assistant', 'content': reply}, {'role': 'user', 'content': fb}]
