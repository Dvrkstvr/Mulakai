"""SP-7: builds read.html (blind read page) from results/{qwen3,gemma4,gemma3,mistral}.json. Arms are shuffled per request (fixed seed) and
labelled X1..X4; the arm names are base64 in the page and show only after "reveal". Look copied from SP-5's lyrics.html. Throwaway."""
import base64
import json
import os
import random

HERE = os.path.dirname(os.path.abspath(__file__))
ARMS = ['qwen3', 'gemma4', 'gemma3', 'mistral']
NAMES = {'qwen3': 'qwen3:14b (control)', 'gemma4': 'gemma4 26B-A4B', 'gemma3': 'gemma3:12b', 'mistral': 'mistral-small3.2:24b'}
DE = ['RC05', 'RC06', 'RC07', 'DE08', 'DE09', 'DE10']
ES = ['RC08', 'RC09', 'RC10']
res = {a: json.load(open(os.path.join(HERE, 'results', a + '.json'), encoding='utf8')) for a in ARMS}
rng = random.Random(20261008)


def build(ids):
    out = []
    for cid in ids:
        order = ARMS[:]
        rng.shuffle(order)
        c0 = res['qwen3']['cases'][cid]
        out.append({'id': cid, 'request': c0['request'], 'title': c0['title'], 'style': c0['style'], 'bpm': c0['bpm'], 'structure': c0['structure'],
                    'arms': [{'x': f'X{i + 1}', 'k': base64.b64encode(a.encode()).decode(), 'lyrics': res[a]['cases'][cid]['lyrics']} for i, a in enumerate(order)]})
    return out


names = {base64.b64encode(a.encode()).decode(): NAMES[a] for a in ARMS}
page = TEMPLATE = open(os.path.join(HERE, 'read_template.html'), encoding='utf8').read()
page = page.replace('/*DE*/[]', json.dumps(build(DE), ensure_ascii=False)).replace('/*ES*/[]', json.dumps(build(ES), ensure_ascii=False))
page = page.replace('/*NAMES*/{}', json.dumps(names, ensure_ascii=False))
open(os.path.join(HERE, 'read.html'), 'w', encoding='utf8').write(page)
print('wrote read.html', len(page))
