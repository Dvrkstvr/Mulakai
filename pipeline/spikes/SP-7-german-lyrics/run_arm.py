"""SP-7: one arm = one model writing the lyrics of 9 requests (6 German, 3 Spanish) with SP-5's rung-3 lyrics call (same system prompt, user
message, schema, temperature 0.3, strict JSON, reasoning off), ONE attempt per request, nothing picked. Measures per call seconds, load time,
what /api/ps says about GPU residency, and the shape and language checks.
  python run_arm.py <model> [tag]
Env: LLM_URL (default http://127.0.0.1:11545). Throwaway."""
from __future__ import annotations

import json
import os
import subprocess
import sys
import time

import requests

import checks as C
import schemas as S

URL = os.environ.get('LLM_URL', 'http://127.0.0.1:11545')
HERE = os.path.dirname(os.path.abspath(__file__))
SEED = 1
LANG_NAME = {'en': 'English', 'de': 'German (Deutsch)', 'es': 'Spanish (español)'}


def lyrics_rules(lang):   # verbatim from SP-5 ladder.py
    name = LANG_NAME.get(lang, lang)
    return (f"You write song lyrics for Mulakai, a local song studio. Write ONLY in {name}: every line must be natural, singable {name}, no other language, "
            f"no translations, no stage directions, no brackets or tags. You are given the song's title, style and the sung sections in order; write {S.LINES_MIN} to "
            f"{S.LINES_MAX} lines per section, matching the title and style, a chorus that repeats its idea (not a line more than twice), verses that move the story on. "
            'Answer with {"sections": [{"lines": [...]}, ...]}: exactly one entry per listed section, in order.')


def lyrics_schema(n):     # verbatim from SP-5 ladder.py
    return S.obj({'sections': {'type': 'array', 'minItems': n, 'maxItems': n, 'items': S.obj({'lines': S.arr(S.s(1, 120), S.LINES_MIN, S.LINES_MAX)})}})


def messages(request, recipe):
    sung = [t for t in recipe['structure'] if t != 'Intro']
    lang = recipe['language']
    user = (f"REQUEST (the person's own words): {request}\nTITLE: {recipe['title']}\nSTYLE: {recipe['style']}\nTEMPO: {recipe['bpm']} bpm\nLANGUAGE: {LANG_NAME.get(lang, lang)}\n"
            "SUNG SECTIONS IN ORDER:\n" + '\n'.join(f"{i}. {t}" for i, t in enumerate(sung, 1)))
    return sung, [{'role': 'system', 'content': lyrics_rules(lang)}, {'role': 'user', 'content': user}]


def ps():
    return requests.get(f'{URL}/api/ps', timeout=5).json().get('models', [])


def vram_mb():
    o = subprocess.run(['nvidia-smi', '--query-gpu=memory.used', '--format=csv,noheader,nounits'], capture_output=True, text=True).stdout
    return int(o.strip().splitlines()[0])


def release(model):
    t0 = time.time()
    requests.post(f'{URL}/api/generate', json={'model': model, 'keep_alive': 0}, timeout=30)
    while ps() and time.time() - t0 < 20:
        time.sleep(0.1)
    return round(time.time() - t0, 2), not ps()


def chat(model, msgs, sch):
    body = {'model': model, 'messages': msgs, 'stream': False, 'temperature': 0.3, 'max_tokens': 4000, 'seed': SEED, 'reasoning_effort': 'none',
            'response_format': {'type': 'json_schema', 'json_schema': {'name': 'turn', 'strict': True, 'schema': sch}}}
    t0 = time.time()
    r = requests.post(f'{URL}/v1/chat/completions', json=body, timeout=600)
    wall = time.time() - t0
    if r.status_code != 200:
        raise RuntimeError(f'HTTP {r.status_code}: {r.text[:300]}')
    j = r.json()
    ch = j['choices'][0]
    return {'content': ch['message'].get('content') or '', 'finish': ch.get('finish_reason'), 'prompt_tokens': j['usage']['prompt_tokens'],
            'completion_tokens': j['usage']['completion_tokens'], 'wall': round(wall, 2)}


def main():
    model = sys.argv[1]
    tag = sys.argv[2] if len(sys.argv) > 2 else model.replace(':', '_').replace('/', '_')
    reqs = json.load(open(os.path.join(HERE, 'requests.json'), encoding='utf8'))
    base = vram_mb()
    release(model)
    base = vram_mb()
    # load time: an empty generate loads the model and returns
    t0 = time.time()
    requests.post(f'{URL}/api/generate', json={'model': model, 'prompt': '', 'keep_alive': '5m'}, timeout=600)
    load_s = round(time.time() - t0, 2)
    pm = ps()
    res = {'model': model, 'tag': tag, 'load_s': load_s, 'vram_baseline_mb': base, 'vram_loaded_mb': vram_mb(),
           'ps': [{'size': m.get('size'), 'size_vram': m.get('size_vram'), 'context_length': m.get('context_length')} for m in pm], 'cases': {}}
    for cid, rc in reqs.items():
        sung, msgs = messages(rc['request'], rc)
        sch = lyrics_schema(len(sung))
        rec = {'request': rc['request'], 'lang': rc['language'], 'title': rc['title'], 'style': rc['style'], 'bpm': rc['bpm'], 'structure': rc['structure']}
        try:
            out = chat(model, msgs, sch)
        except Exception as e:  # noqa: BLE001
            rec.update({'error': str(e)[:300], 'shape_ok': False, 'lang_ok': False})
            res['cases'][cid] = rec
            print(cid, 'ERROR', e)
            continue
        rec.update({k: out[k] for k in ('wall', 'prompt_tokens', 'completion_tokens', 'finish', 'content')})
        reasons, lyrics = [], None
        try:
            obj = json.loads(out['content'])
            reasons = C.validate(obj, sch)
            if not reasons:
                lyrics = [{'tag': t, 'lines': s['lines']} for t, s in zip(sung, obj['sections'])]
        except Exception:  # noqa: BLE001
            reasons = ['the reply is not valid JSON']
        rec['schema_ok'] = not reasons
        if lyrics:
            probe = dict(rc, lyrics=lyrics)
            lp = [r for r in C.recipe_loop_problems(probe) if 'bracket' in r or 'lines;' in r or 'must follow' in r]
            a, b, per = C.lyrics_language(probe)
            rec.update({'lyrics': lyrics, 'lingua': a, 'langdetect': b, 'per_section': per})
            rec['shape_ok'] = not lp
            rec['lang_ok'] = (a == rc['language'])
            rec['sections_all_lang'] = all(p == rc['language'] for p in per)
            reasons += lp
        else:
            rec['shape_ok'] = False
            rec['lang_ok'] = False
        rec['reasons'] = reasons
        res['cases'][cid] = rec
        print(cid, rec['wall'], 's', 'shape', rec['shape_ok'], 'lang', rec.get('lingua'), flush=True)
    # residency after the run (still loaded)
    pm = ps()
    res['ps_after'] = [{'size': m.get('size'), 'size_vram': m.get('size_vram')} for m in pm]
    res['vram_peak_after_mb'] = vram_mb()
    res['release'] = release(model)
    json.dump(res, open(os.path.join(HERE, 'results', f'{tag}.json'), 'w', encoding='utf8'), ensure_ascii=False, indent=1)
    cs = res['cases'].values()
    walls = [c['wall'] for c in cs if 'wall' in c]
    print('SUMMARY', tag, 'shape', sum(c['shape_ok'] for c in cs), '/', len(res['cases']), 'lang', sum(c['lang_ok'] for c in cs),
          'median s', sorted(walls)[len(walls) // 2] if walls else None, 'load', load_s, 'ps', res['ps'])


if __name__ == '__main__':
    main()
