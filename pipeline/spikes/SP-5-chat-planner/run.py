"""SP-5 runner: scripted conversations -> one turn per user message through qwen3:14b (strict JSON schema, reasoning off,
<= 3 attempts with feedback), per-turn unload + /api/ps empty check. Mode `base` = one call per turn (rungs: see ladder.py).
  python run.py --mode base --rep 1 [--only RC01,MT02] [--no-release]
Writes results/<mode>_r<rep>.jsonl (one record per turn, raw replies included). Throwaway."""
from __future__ import annotations

import argparse
import json
import os
import sys
import time

sys.path.insert(0, r"E:\ai\tmp\sp5\site")

import checks as C  # noqa: E402
import llm  # noqa: E402
import prompt as P  # noqa: E402
import schemas as S  # noqa: E402
import songs  # noqa: E402
import ladder  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
MAX_ATTEMPTS = 3
MAX_REASONS = 8


def apply_reasons(res):
    ops = [f"op {v['index']} ({v['op']}): {v.get('reason') or 'did not apply'}" for v in res['verdicts'] if not v['ok']]
    out = ops + list(res['checks']['problems']) + list(res['checks']['differences'])
    return out or ['the edited score did not pass the check']


def edit_reasons(reply, song):
    """The existing validators: yue-server /v1/scores/apply (CPU). Returns (reasons, seconds)."""
    if not song:
        return ['there is no song yet: an edit needs a SONG block; answer with recipe, ask or say instead'], 0.0
    t0 = time.time()
    res, err = songs.apply_ops(song, reply['ops'])
    dt = time.time() - t0
    if res is None:
        return [err], dt
    return ([] if res['ok'] else apply_reasons(res)), dt


def history_text(reply):
    a = reply.get('action')
    msg = reply.get('message', '')
    if a == 'recipe':
        r = reply['recipe']
        return f"{msg} [new-song card: \"{r['title']}\" · {r['style']} · {r['bpm']} bpm · {r['key']} · {r['language']}]"
    if a == 'edit':
        return f"{msg} [edit card: {C.summarize_ops(reply['ops'])}]"
    return msg


def schema_for(state, text):
    song = state.get('song')
    return S.turn_schema(song['facts'] if song else None, P.phrase_bars_of(text))


def call_loop(messages, schema, song, seed, loop_checks=True, check_recipe=True):
    attempts, msgs, reply, accepted = [], messages, None, False
    apply_s = 0.0
    for n in range(1, MAX_ATTEMPTS + 1):
        out = llm.chat(msgs, schema, seed=seed + n - 1)
        rec = {'n': n, 'prompt_tokens': out['prompt_tokens'], 'completion_tokens': out['completion_tokens'], 'wall': round(out['wall'], 2),
               'finish': out['finish'], 'content': out['content']}
        reasons, obj = [], None
        try:
            obj = json.loads(out['content'])
        except Exception:
            reasons = [f"the reply is not valid JSON (finish_reason {out['finish']})"]
        if obj is not None:
            reasons = C.validate(obj, schema)
            rec['schema_ok'] = not reasons
            if not reasons and loop_checks:
                if obj['action'] == 'edit':
                    reasons, dt = edit_reasons(obj, song)
                    apply_s += dt
                    rec['apply_ok'] = not reasons
                elif obj['action'] == 'recipe' and check_recipe:
                    reasons = C.recipe_loop_problems(obj['recipe'])
        else:
            rec['schema_ok'] = False
        rec['reasons'] = reasons[:MAX_REASONS]
        attempts.append(rec)
        reply = obj if obj is not None else reply
        if not reasons:
            accepted = True
            break
        msgs = P.retry_messages(msgs, out['content'], reasons[:MAX_REASONS])
    return attempts, reply, accepted, apply_s


def do_turn(mode, state, text, seed):
    """One turn under a ladder mode. Returns attempts (all calls), reply, accepted, apply seconds, extra info."""
    flags = set(mode.split('+'))
    song = state.get('song')
    with_lyrics = 'lyrics' not in flags
    allowed = ladder.allowed_actions(state) if 'allowed' in flags else list(S.ACTIONS)
    extra = {'allowed': allowed}
    if 'router' in flags:
        action, rrec = ladder.route(state, text, allowed, seed)
        extra['router'] = rrec
        if action is None:
            action = 'say'
        extra['routed'] = action
        msgs = ladder.action_messages(action, state, text, with_lyrics)
        schema = ladder.action_schema(action, state, text, with_lyrics)
    else:
        rules = P.rules_for(allowed, with_lyrics)
        msgs = P.build_messages(state, text, rules=rules)
        schema = S.turn_schema(song['facts'] if song else None, P.phrase_bars_of(text), allowed, with_lyrics)
    attempts, reply, accepted, apply_s = call_loop(msgs, schema, song, seed, check_recipe=with_lyrics)
    if accepted and reply and reply['action'] == 'recipe' and not with_lyrics:
        lyr, latts, ok = ladder.lyrics_call(text, reply['recipe'], seed + 100)
        attempts += latts
        if lyr is not None:
            reply['recipe']['lyrics'] = lyr
        accepted = accepted and ok and lyr is not None
    return attempts, reply, accepted, apply_s, extra


def run_conversation(conv, library_songs, mode, rep, release=True, log=print):
    song = library_songs[conv['song']] if conv['song'] else None
    state = {'song': song, 'library': songs.LIBRARY_TITLES, 'pending': None, 'history': [], 'mark': None, 'attachment': None}
    recs = []
    for ti, turn in enumerate(conv['turns']):
        state['mark'] = turn.get('mark')
        state['attachment'] = turn.get('attachment')
        ps_before = llm.ps()
        t0 = time.time()
        attempts, reply, accepted, apply_s, extra = do_turn(mode, state, turn['user'], seed=1000 * rep + 10 * ti + 1)
        wall = time.time() - t0
        cur = state.get('song')
        unload_ms, polls, ok = (llm.release() if release else (None, 0, None))
        first_ok = bool(attempts and attempts[0].get('schema_ok'))
        rec = {'conv': conv['id'], 'turn': turn['id'], 'ti': ti, 'mode': mode, 'rep': rep, 'user': turn['user'], 'song': conv['song'],
               'accepted': accepted, 'attempts': attempts, 'reply': reply, 'wall': round(wall, 2), 'model_s': round(sum(a['wall'] for a in attempts) + (extra['router']['wall'] if 'router' in extra else 0), 2),
               'apply_s': round(apply_s, 2), 'extra': extra, 'ps_before_empty': not ps_before, 'unload_ms': unload_ms, 'unload_polls': polls, 'unload_ok': ok,
               'prompt_tokens_first': max([attempts[0]['prompt_tokens']] + ([extra['router']['prompt_tokens']] if 'router' in extra else [])),
               'first_schema_ok': first_ok,
               'ctx_state': {'bars': cur['facts']['header']['bars'] if cur else None, 'versions': len(cur['versions']) if cur else 0,
                             'pending': state['pending']['kind'] if state['pending'] else None, 'hist_lines': len(state['history']),
                             'pending_bpm': state['pending']['recipe']['bpm'] if state['pending'] and state['pending']['kind'] == 'recipe' else None,
                             'pending_key': state['pending']['recipe']['key'] if state['pending'] and state['pending']['kind'] == 'recipe' else None,
                             'song_key': cur['facts']['header']['key'] if cur else None}}
        # the reply the conversation continues with: the model's own when it is valid and the expected action, else the scripted fixture
        exp = turn['expect']
        ok_actions = {exp.get('action')} | set(exp.get('alt', []))
        used, src = None, None
        if accepted and reply and reply.get('action') in ok_actions:
            used, src = reply, 'model'
        elif turn.get('fixture'):
            used, src = turn['fixture'], 'fixture'
        elif accepted and reply:
            used, src = reply, 'model-wrong-action'
        rec['used'] = src
        recs.append(rec)
        log(f"  {turn['id']:9s} {reply.get('action') if reply else None!s:8s} acc={accepted} att={len(attempts)} wall={wall:5.1f}s tok={attempts[0]['prompt_tokens']} used={src}")
        # state for the next turn
        if used:
            state['history'] = (state['history'] + [('user', turn['user']), ('assistant', history_text(used))])[-8:]
            if used['action'] == 'recipe':
                state['pending'] = {'kind': 'recipe', 'recipe': used['recipe']}
            elif used['action'] == 'edit':
                state['pending'] = {'kind': 'edit', 'ops': used['ops'], 'against': f"v{len(state['song']['versions'])}" if state.get('song') else 'v1'}
                if turn.get('commit') and state.get('song'):
                    state['song'] = songs.commit(state['song'], used['ops'], C.summarize_ops(used['ops'])[:60])
                    state['pending'] = None
        else:
            state['history'] = (state['history'] + [('user', turn['user'])])[-8:]
    return recs


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--mode', default='base')
    ap.add_argument('--rep', type=int, default=1)
    ap.add_argument('--only', default='')
    ap.add_argument('--no-release', action='store_true')
    ap.add_argument('--out', default='')
    a = ap.parse_args()
    cases = json.load(open(os.path.join(HERE, 'cases.json'), encoding='utf8'))
    if a.only:
        want = set(a.only.split(','))
        cases = [c for c in cases if c['id'] in want]
    library = songs.load()
    os.makedirs(os.path.join(HERE, 'results'), exist_ok=True)
    out = a.out or os.path.join(HERE, 'results', f"{a.mode}_r{a.rep}.jsonl")
    with open(out, 'w', encoding='utf8') as fh:
        for c in cases:
            print(c['id'], c['group'], c['song'])
            for rec in run_conversation(c, library, a.mode, a.rep, release=not a.no_release):
                fh.write(json.dumps(rec, ensure_ascii=False) + '\n')
                fh.flush()


if __name__ == '__main__':
    main()
