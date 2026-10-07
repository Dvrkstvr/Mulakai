"""SP-5 fallback ladder (scope.md D-097): rung 1 router call (one enum) + a per-action call; rung 2 offer only the actions the state
allows; rung 3 lyrics as their own call (per-language prompt); rung 4 the MoE (an env value: LLM_MODEL). Modes are '+'-joined flags:
  base | allowed | router | router+allowed | lyrics | allowed+lyrics | router+allowed+lyrics
Throwaway."""
from __future__ import annotations

import json
import time

import checks as C
import llm
import prompt as P
import schemas as S

LANG_NAME = {'en': 'English', 'de': 'German (Deutsch)', 'es': 'Spanish (español)', 'fr': 'French', 'it': 'Italian', 'pt': 'Portuguese'}


def allowed_actions(state):
    """What the state allows: with no song there is nothing to edit or repaint (rung 2)."""
    if state.get('song'):
        return list(S.ACTIONS)
    return ['ask', 'recipe', 'analyze', 'say']


# ---------------------------------------------------------------- rung 1: the router
ROUTE_TAIL = ("\n\nA request that changes THIS song's score (chords, words, tempo, key, style, repeat/cut) is edit; a request that needs audio work (repaint, a new layer, stems, a file) "
              "is scalpel; a request for a different new song is recipe; a vague wish with nothing to act on is ask; a question is say.")


def router_rules():
    """The router's system prompt: the action texts of the one-call prompt (v3 wording when P.V3), without the ops reference or the recipe fields."""
    old_tail = 'Every turn you answer with ONE JSON object {"action": ...} and nothing else, in the person\'s language for message and assumptions.'
    intro = P.INTRO.replace(old_tail, 'Here you only ROUTE the turn: answer with {"action": ...}, the single best action for the request, nothing else.')
    texts = [P.ACTION_TEXT[a] for a in P.TEXT_ORDER]
    if P.V3:
        texts = [P._v3(t) for t in texts]
    texts = [t.split(' Answer with ops')[0] + '.' if t.startswith('- edit') else t for t in texts]
    return intro + "\n\nACTIONS:\n" + "\n".join(texts) + ROUTE_TAIL


ROUTER_RULES = router_rules()


def compact_pending(p):
    if not p:
        return None
    if p['kind'] == 'recipe':
        r = p['recipe']
        return f"PENDING PROPOSAL: a new-song card \"{r['title']}\" ({r['style']}; {r['bpm']} bpm, {r['key']}, {r['language']}; {', '.join(r['structure'])})"
    return f"PENDING PROPOSAL: an edit card against {p['against']}: {C.summarize_ops(p['ops'])}"


def router_messages(state, text, allowed):
    song = state.get('song')
    parts = [P.song_block(song, state['library'], bar_map=False)]
    for x in (compact_pending(state.get('pending')), P.fmt_history(state.get('history'))):
        if x:
            parts += ['', x]
    if state.get('attachment'):
        parts.append(f"ATTACHED: {state['attachment']}")
    if state.get('mark'):
        parts.append(P.mark_line(state['mark']))
    parts += ['', f"REQUEST: {text}", f"Reply with {{\"action\": one of {', '.join(allowed)}}}."]
    return [{'role': 'system', 'content': router_rules()}, {'role': 'user', 'content': '\n'.join(parts)}]


def router_schema(allowed):
    return S.obj({'action': {'enum': allowed}})


def route(state, text, allowed, seed):
    msgs = router_messages(state, text, allowed)
    out = llm.chat(msgs, router_schema(allowed), seed=seed, max_tokens=40)
    try:
        action = json.loads(out['content'])['action']
    except Exception:
        action = None
    return action, {'prompt_tokens': out['prompt_tokens'], 'completion_tokens': out['completion_tokens'], 'wall': round(out['wall'], 2), 'content': out['content']}


# ---------------------------------------------------------------- per-action calls
def action_messages(action, state, text, with_lyrics=True, was=False):
    rules = P.rules_for([action], with_lyrics, was)
    return P.build_messages(state, text, rules=rules, bar_map=(action == 'edit'))


def action_schema(action, state, text, with_lyrics=True, was=False):
    song = state.get('song')
    return S.action_schema(action, song['facts'] if song else None, P.phrase_bars_of(text), with_lyrics=with_lyrics, was=was)


# ---------------------------------------------------------------- rung 3: lyrics as their own call
def lyrics_rules(lang):
    name = LANG_NAME.get(lang, lang)
    return (f"You write song lyrics for Mulakai, a local song studio. Write ONLY in {name}: every line must be natural, singable {name}, no other language, "
            f"no translations, no stage directions, no brackets or tags. You are given the song's title, style and the sung sections in order; write {S.LINES_MIN} to "
            f"{S.LINES_MAX} lines per section, matching the title and style, a chorus that repeats its idea (not a line more than twice), verses that move the story on. "
            'Answer with {"sections": [{"lines": [...]}, ...]}: exactly one entry per listed section, in order.')


def lyrics_schema(n):
    return S.obj({'sections': {'type': 'array', 'minItems': n, 'maxItems': n, 'items': S.obj({'lines': S.arr(S.s(1, 120), S.LINES_MIN, S.LINES_MAX)})}})


def lyrics_call(request, recipe, seed, max_attempts=3):
    """Writes the lyrics of `recipe` (lyrics not yet set) in its language; retries on language mismatch with feedback. Returns (lyrics, attempts)."""
    sung = [t for t in recipe['structure'] if t != 'Intro']
    lang = recipe['language']
    user = (f"REQUEST (the person's own words): {request}\nTITLE: {recipe['title']}\nSTYLE: {recipe['style']}\nTEMPO: {recipe['bpm']} bpm\nLANGUAGE: {LANG_NAME.get(lang, lang)}\n"
            "SUNG SECTIONS IN ORDER:\n" + '\n'.join(f"{i}. {t}" for i, t in enumerate(sung, 1)))
    msgs = [{'role': 'system', 'content': lyrics_rules(lang)}, {'role': 'user', 'content': user}]
    atts, lyrics = [], None
    sch = lyrics_schema(len(sung))
    for n in range(1, max_attempts + 1):
        out = llm.chat(msgs, sch, seed=seed + n - 1)
        rec = {'n': n, 'call': 'lyrics', 'prompt_tokens': out['prompt_tokens'], 'completion_tokens': out['completion_tokens'], 'wall': round(out['wall'], 2),
               'finish': out['finish'], 'content': out['content']}
        reasons = []
        try:
            obj = json.loads(out['content'])
            reasons = C.validate(obj, sch)
        except Exception:
            obj, reasons = None, ['the reply is not valid JSON']
        rec['schema_ok'] = not reasons
        if not reasons:
            cand = [{'tag': t, 'lines': s['lines']} for t, s in zip(sung, obj['sections'])]
            probe = dict(recipe, lyrics=cand)
            reasons = [r for r in C.recipe_loop_problems(probe) if 'language' in r or 'bracket' in r]
            lyrics = cand
        rec['reasons'] = reasons
        atts.append(rec)
        if not reasons:
            return lyrics, atts, True
        msgs = P.retry_messages(msgs, out['content'], reasons)
    return lyrics, atts, False
