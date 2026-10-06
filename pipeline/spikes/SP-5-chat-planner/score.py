"""SP-5 scorer: results/<mode>_r*.jsonl + cases.json -> per-turn verdicts and the bars (a)..(g). Re-runnable on stored raw replies.
  python score.py base            (all reps of results/base_r*.jsonl)  -> results/score_<mode>.json
Throwaway."""
from __future__ import annotations

import glob
import json
import os
import re
import statistics
import sys

sys.path.insert(0, r"E:\ai\tmp\sp5\site")

import checks as C  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))


def pct(xs, p):
    xs = sorted(xs)
    if not xs:
        return None
    k = (len(xs) - 1) * p
    lo, hi = int(k), min(int(k) + 1, len(xs) - 1)
    return round(xs[lo] + (xs[hi] - xs[lo]) * (k - lo), 2)


def first_obj(rec):
    try:
        return json.loads(rec['attempts'][0]['content'])
    except Exception:
        return None


def judge_turn(rec, turn, case):
    ex = turn['expect']
    reply = rec['reply']
    first = first_obj(rec)
    action = reply.get('action') if reply else None
    ok_actions = {ex.get('action')} | set(ex.get('alt', []))
    j = {'turn': rec['turn'], 'rep': rec['rep'], 'group': case['group'], 'expected': ex.get('action'), 'action': action,
         'first_action': first.get('action') if first else None, 'accepted': rec['accepted'], 'attempts': len(rec['attempts']),
         'action_ok': action in ok_actions, 'first_action_ok': (first.get('action') in ok_actions) if first else False,
         'must_propose': bool(ex.get('must_propose')), 'stuck': bool(ex.get('stuck')), 'ask_on_must': bool(ex.get('must_propose')) and action == 'ask',
         'schema_first': rec['first_schema_ok'], 'schema_any': any(a.get('schema_ok') for a in rec['attempts']),
         'wall': rec['wall'], 'model_s': rec['model_s'], 'prompt_tokens': rec['prompt_tokens_first'], 'bars': rec['ctx_state']['bars'],
         'unload_ms': rec['unload_ms'], 'unload_ok': rec['unload_ok'], 'ps_before_empty': rec['ps_before_empty']}
    notes = []
    # ---- recipe: bar (c) and (d), on the first attempt (strict) and the final reply
    if ex.get('action') == 'recipe':
        for tag, obj in (('first', first), ('final', reply)):
            good = bool(obj and obj.get('action') == 'recipe')
            fprob, lprob = (C.recipe_problems(obj['recipe']) if good else (['not a recipe'], ['not a recipe']))
            a_lid, b_lid, per = C.lyrics_language(obj['recipe']) if good else (None, None, [])
            j[f'recipe_fields_ok_{tag}'] = good and not fprob
            j[f'lyric_shape_ok_{tag}'] = good and not lprob
            j[f'lang_{tag}'] = a_lid
            j[f'lang_ld_{tag}'] = b_lid
            j[f'lang_ok_{tag}'] = good and a_lid == ex['lang']
            j[f'lang_sections_{tag}'] = per
            j[f'lang_sections_ok_{tag}'] = [p == ex['lang'] for p in per]
            if tag == 'final' and good:
                j['structure_ok'] = C.sung_matches_structure(obj['recipe'])
                lines = [ln for s in obj['recipe']['lyrics'] for ln in s['lines']]
                j['n_lines'] = len(lines)
                j['dup_lines'] = len(lines) - len(set(lines))
                j['paren_lines'] = sum(1 for ln in lines if re.search(r"\([^)]*\)", ln))
                r = obj['recipe']
                if ex.get('bpm'):
                    j['bpm_intent'] = ex['bpm'][0] <= r['bpm'] <= ex['bpm'][1]
                if ex.get('style_has'):
                    j['style_intent'] = all(re.search(t, r['style'], re.I) for t in ex['style_has'])
                if ex.get('vague'):
                    j['assumption_stated'] = bool(obj.get('assumptions'))
                if ex.get('refine'):
                    rf = ex['refine']
                    if rf.get('bpm_above_pending'):
                        j['refine_bpm'] = r['bpm'] > (rec['ctx_state']['pending_bpm'] or 0)
                    if rf.get('structure_has'):
                        j['refine_structure'] = rf['structure_has'] in r['structure']
                    if rf.get('has_bridge_lyrics'):
                        j['refine_bridge_lyrics'] = any(s['tag'] == 'Bridge' for s in r['lyrics'])
        j['intent_ok'] = bool(j.get('recipe_fields_ok_final') and j.get('lang_ok_final') and j.get('bpm_intent', True) and j.get('style_intent', True)
                              and j.get('refine_bpm', True) and j.get('refine_structure', True) and j.get('refine_bridge_lyrics', True))
    # ---- edit
    elif ex.get('action') == 'edit':
        ok_valid = bool(rec['accepted'] and action == 'edit')
        j['edit_valid'] = ok_valid
        j['edit_valid_first'] = bool(first and first.get('action') == 'edit' and rec['attempts'][0].get('apply_ok'))
        if action == 'edit':
            j['ops'] = C.summarize_ops(reply['ops'])
            j['assumption_stated'] = bool(reply.get('assumptions'))
            if ex.get('edit'):
                ok, why = C.edit_intent(reply['ops'], ex['edit'], None)
                j['intent_ok'] = bool(ok and ok_valid)
                j['intent_why'] = why
        else:
            j['intent_ok'] = False
        j['marked'] = bool(ex.get('marked'))
    elif ex.get('action') == 'say':
        msg = (reply or {}).get('message', '')
        if ex.get('contains'):
            j['intent_ok'] = action == 'say' and bool(re.search(ex['contains'], msg, re.I))
        elif ex.get('says_pending_key'):
            j['intent_ok'] = action == 'say' and bool(C.key_regex(rec['ctx_state']['pending_key']).search(msg))
        elif ex.get('says_current_key'):
            j['intent_ok'] = action == 'say' and bool(C.key_regex(rec['ctx_state']['song_key']).search(msg))
        elif ex.get('says_pending_bpm'):
            j['intent_ok'] = action == 'say' and str(rec['ctx_state'].get('pending_bpm')) in msg
        else:
            j['intent_ok'] = action == 'say'
        if ex.get('nonexistent'):
            # strict: say or ask only; an edit that the validators accept is still a silent substitution (recorded, not credited)
            j['alt_edit'] = action == 'edit' and rec['accepted']
            j['intent_ok'] = j['action_ok']
        j['say_message'] = msg[:200]
    elif ex.get('action') == 'scalpel':
        j['intent_ok'] = action == 'scalpel' and reply.get('kind') == ex['kind']
        j['kind'] = reply.get('kind') if action == 'scalpel' else None
    else:
        j['intent_ok'] = j['action_ok']
    if j['stuck']:
        j['intent_ok'] = action == 'ask'
    return j


def load_rows(mode):
    cases = {c['id']: c for c in json.load(open(os.path.join(HERE, 'cases.json'), encoding='utf8'))}
    turn_case = {t['id']: (t, c) for c in cases.values() for t in c['turns']}
    recs = []
    for f in sorted(glob.glob(os.path.join(HERE, 'results', f'{mode}_r*.jsonl'))):
        recs += [json.loads(line) for line in open(f, encoding='utf8')]
    return recs, turn_case


def rate(xs):
    xs = list(xs)
    return {'n': len(xs), 'ok': sum(1 for x in xs if x), 'pct': round(100 * sum(1 for x in xs if x) / len(xs), 1) if xs else None}


def bars(mode):
    recs, turn_case = load_rows(mode)
    rows = [judge_turn(r, *turn_case[r['turn']]) for r in recs]
    reps = sorted({r['rep'] for r in rows})
    single = [r for r in rows if r['group'] != 'multi']
    out = {'mode': mode, 'reps': reps, 'turns': len(rows), 'single_turn_cases': len(single) // max(1, len(reps))}
    # (a)
    out['a'] = {'first_try_schema_valid': rate(r['schema_first'] for r in rows), 'within_3_attempts_schema_valid': rate(r['schema_any'] for r in rows),
                'accepted_within_3': rate(r['accepted'] for r in rows)}
    # (b)
    must = [r for r in single if r['must_propose']]
    stuck = [r for r in single if r['stuck']]
    out['b'] = {'action_right_single': rate(r['action_ok'] for r in single), 'action_right_first_attempt': rate(r['first_action_ok'] for r in single),
                'ask_on_must_propose': {'n': len(must), 'asked': sum(r['ask_on_must'] for r in must)},
                'stuck_asked': rate(r['action'] == 'ask' for r in stuck),
                'by_group': {g: rate(r['action_ok'] for r in single if r['group'] == g) for g in sorted({r['group'] for r in single})},
                'action_right_all_turns': rate(r['action_ok'] for r in rows)}
    # (c)
    rc = [r for r in rows if r['expected'] == 'recipe']
    vague = [r for r in rc if 'assumption_stated' in r and any(t['expect'].get('vague') for t, c in [turn_case[r['turn']]])]
    out['c'] = {'recipes': len(rc), 'fields_valid_first': rate(r.get('recipe_fields_ok_first') for r in rc),
                'fields_valid_final': rate(r.get('recipe_fields_ok_final') for r in rc),
                'assumption_on_vague': rate(r.get('assumption_stated') for r in vague),
                'bpm_intent': rate(r['bpm_intent'] for r in rc if 'bpm_intent' in r), 'style_intent': rate(r['style_intent'] for r in rc if 'style_intent' in r),
                'refine': {k: rate(r[k] for r in rc if k in r) for k in ('refine_bpm', 'refine_structure', 'refine_bridge_lyrics')},
                'assumption_on_all_recipes': rate(bool((json.loads(next(x for x in recs if x['turn'] == r['turn'] and x['rep'] == r['rep'])['attempts'][-1]['content']) or {}).get('assumptions')) for r in rc if r['action'] == 'recipe')}
    # (d)
    lang = {}
    for r in rc:
        want = turn_case[r['turn']][0]['expect']['lang']
        lang.setdefault(want, []).append(r)
    out['d'] = {'lyric_shape_first': rate(r.get('lyric_shape_ok_first') for r in rc), 'lyric_shape_final': rate(r.get('lyric_shape_ok_final') for r in rc),
                'language_first_by_lang': {k: rate(r.get('lang_ok_first') for r in v) for k, v in lang.items()},
                'language_final_by_lang': {k: rate(r.get('lang_ok_final') for r in v) for k, v in lang.items()},
                'language_sections_final': rate(x for r in rc for x in r.get('lang_sections_ok_final', [])),
                'langdetect_agrees_final': rate((r.get('lang_ld_final') == r.get('lang_final')) for r in rc),
                'structure_follows': rate(r.get('structure_ok') for r in rc), 'dup_lines_total': sum(r.get('dup_lines', 0) for r in rc),
                'paren_lines_total': sum(r.get('paren_lines', 0) for r in rc), 'lines_total': sum(r.get('n_lines', 0) for r in rc)}
    # (e)
    ed = [r for r in rows if r['expected'] == 'edit']
    out['e'] = {'edit_turns': len(ed), 'valid_within_3': rate(r.get('edit_valid') for r in ed), 'valid_first_try': rate(r.get('edit_valid_first') for r in ed),
                'intent_ok': rate(r.get('intent_ok') for r in ed if 'intent_why' in r or r.get('intent_ok') is False),
                'marked_intent_ok': rate(r.get('intent_ok') for r in ed if r.get('marked')),
                'unmarked_intent_ok': rate(r.get('intent_ok') for r in ed if not r.get('marked')),
                'assumption_stated': rate(r.get('assumption_stated') for r in ed),
                'ops_attempts_used': {str(k): sum(1 for r in ed if r['attempts'] == k) for k in (1, 2, 3)}}
    # (f)
    walls = [r['wall'] for r in rows]
    warm = walls[1:] if len(walls) > 1 else walls
    out['f'] = {'turn_wall_p50': pct(warm, .5), 'turn_wall_p95': pct(warm, .95), 'turn_wall_max': max(walls), 'model_s_p50': pct([r['model_s'] for r in rows], .5),
                'by_group_p50': {g: pct([r['wall'] for r in rows if r['group'] == g], .5) for g in sorted({r['group'] for r in rows})},
                'by_expected_p50': {g: pct([r['wall'] for r in rows if r['expected'] == g], .5) for g in sorted({r['expected'] for r in rows})},
                'by_expected_p95': {g: pct([r['wall'] for r in rows if r['expected'] == g], .95) for g in sorted({r['expected'] for r in rows})},
                'unload_ms_p50': pct([r['unload_ms'] for r in rows if r['unload_ms'] is not None], .5), 'unload_ms_max': max([r['unload_ms'] or 0 for r in rows]),
                'unload_ok': rate(r['unload_ok'] for r in rows), 'ps_empty_before_turn': rate(r['ps_before_empty'] for r in rows),
                'turns_over_15s': sum(1 for w in warm if w > 15), 'turns_over_30s': sum(1 for w in warm if w > 30)}
    # (g)
    pt = [r['prompt_tokens'] for r in rows]
    long = [r['prompt_tokens'] for r in rows if r['bars'] and r['bars'] >= 200]
    out['g'] = {'prompt_tokens_p50': pct(pt, .5), 'prompt_tokens_p95': pct(pt, .95), 'prompt_tokens_max': max(pt),
                'on_206_bar_song': {'n': len(long), 'max': max(long) if long else None}}
    out['rows'] = rows
    return out


if __name__ == '__main__':
    mode = sys.argv[1] if len(sys.argv) > 1 else 'base'
    res = bars(mode)
    path = os.path.join(HERE, 'results', f'score_{mode}.json')
    json.dump(res, open(path, 'w', encoding='utf8'), ensure_ascii=False, indent=1)
    for k in 'abcdefg':
        print(k, json.dumps(res[k], ensure_ascii=False))
    print('wrote', path)
