"""Consolidates results/score_<mode>.json (+ probe_tokens.json, langid.json) into results.json, and prints a compact table of bars per mode.
  python make_results.py v2 v3+rle ...   (modes in the order to list)
Throwaway."""
from __future__ import annotations

import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
R = os.path.join(HERE, 'results')


def load(name):
    p = os.path.join(R, name)
    return json.load(open(p, encoding='utf8')) if os.path.exists(p) else None


def line(mode, s):
    a, b, c, d, e, f, g = (s[k] for k in 'abcdefg')
    langs = d['language_final_by_lang']
    return (f"{mode:16s} turns={s['turns']:3d} | a first {a['first_try_schema_valid']['pct']}% / 3x {a['within_3_attempts_schema_valid']['pct']}% | "
            f"b action {b['action_right_single']['pct']}% ask-on-must {b['ask_on_must_propose']['asked']}/{b['ask_on_must_propose']['n']} stuck {b['stuck_asked']['ok']}/{b['stuck_asked']['n']} | "
            f"c fields {c['fields_valid_first']['pct']}% vague-assumed {c['assumption_on_vague']['ok']}/{c['assumption_on_vague']['n']} | "
            f"d shape {d['lyric_shape_first']['pct']}% lang " + '/'.join(f"{k}{v['pct']:.0f}" for k, v in langs.items()) + " | "
            f"e valid3 {e['valid_within_3']['pct']}% first {e['valid_first_try']['pct']}% intent {e['intent_ok']['pct']}% marked {e['marked_intent_ok']['ok']}/{e['marked_intent_ok']['n']} | "
            f"f p50 {f['turn_wall_p50']}s p95 {f['turn_wall_p95']}s | g p95 {g['prompt_tokens_p95']} max {g['prompt_tokens_max']}")


def main():
    modes = sys.argv[1:]
    out = {'generated_by': 'make_results.py', 'model': 'qwen3:14b Q4_K_M, Ollama 0.32.15, ctx 16384, reasoning off, temperature 0.3, max_tokens 4000',
           'modes': {}, 'probe_tokens_rle': load('probe_tokens_rle.json'), 'probe_tokens_no_rle': load('probe_tokens_v3.json'), 'langid': load('langid.json'), 'extras': load('extras.json')}
    out['mode_legend'] = {
        'base': 'prompt v1, one call, max_tokens 2000 (first run, 1 rep; scored with the final scorer; MT03.t3 recorded the stale key, so its say verdict there is not reliable)',
        'v2': 'v1 + compact-JSON line, STYLE-may-be-stale note, stronger root-change text, say precision, analyze guard, max_tokens 4000 (2 reps)',
        'v2+was': 'v2 + the `was` helper field on REHARMONIZE chords (1 rep, not adopted)',
        'v3+rle': 'v2 + v3 text (assumptions not parroted, verse != chorus, edit-vs-recipe, repaint = scalpel, nonexistent section -> say, first of several, REWRITE_LYRICS keeps the song language, bare yes/like that one -> ask) + code guards (language of a rewritten block, section word the song lacks) + the app tempo/key hints stripped from STYLE + run-length bar map (2 reps)',
        'v31+rle': 'v3+rle + the HEADER key in words + flat/sharp signs in the stripped hints + a say-guard on the key named (1 rep) = the recommended prompt',
        'v3+rle+allowed': 'v3+rle with ladder rung 2 (only the actions the state allows; 1 rep)',
        'v3+rle+router': 'v3+rle with ladder rung 1 (router call + per-action call; 1 rep)',
        'long': 'cases_long.json: 3 conversations x 4 turns on the 206-bar song (pending plans, history), v2 prompt, no run-length bar map',
        'long+v3+rle': 'the same with the v3 prompt and the run-length bar map',
        'holdout+v31+rle': 'cases_holdout.json: 20 fresh single turns written after tuning, v31+rle, no tuning afterwards'}
    for m in modes:
        s = load(f'score_{m}.json')
        if not s:
            print('missing', m)
            continue
        rows = s.pop('rows')
        out['modes'][m] = {'bars': {k: s[k] for k in 'abcdefg'}, 'turns': s['turns'], 'reps': s['reps'],
                           'rows': [{k: v for k, v in r.items() if k not in ('say_message',)} for r in rows]}
        print(line(m, s))
    json.dump(out, open(os.path.join(HERE, 'results.json'), 'w', encoding='utf8'), ensure_ascii=False, indent=1)
    print('wrote results.json', os.path.getsize(os.path.join(HERE, 'results.json')), 'bytes')


if __name__ == '__main__':
    main()
