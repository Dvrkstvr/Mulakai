"""Builds lyrics.html: the 10 lyric sets (RC01..RC10 of one rep, no cherry-picking) for the owner's read of bar (d).
  python make_lyrics_page.py <results.jsonl>   (default results/base_r1.jsonl)
Throwaway."""
from __future__ import annotations

import html
import json
import os
import sys

sys.path.insert(0, r"E:\ai\tmp\sp5\site")
import checks as C  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
LANG = {'en': 'English', 'de': 'German', 'es': 'Spanish'}
SPARE = 'RC03'


def main():
    src = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, 'results', 'base_r1.jsonl')
    alt_src = sys.argv[2] if len(sys.argv) > 2 else None   # optional: the same 10 requests with the lyrics written in a second call (ladder rung 3), shown folded as B
    alt = {json.loads(l)['turn']: json.loads(l) for l in open(alt_src, encoding='utf8')} if alt_src else {}
    cases = {c['id']: c for c in json.load(open(os.path.join(HERE, 'cases.json'), encoding='utf8'))}
    recs = {json.loads(l)['turn']: json.loads(l) for l in open(src, encoding='utf8')}
    sets = []
    for n in range(1, 11):
        cid = f'RC{n:02d}'
        rec = recs[cid + '.t1']
        rp = rec['reply']
        ex = cases[cid]['turns'][0]['expect']
        if rp and rp.get('action') == 'recipe':
            r = rp['recipe']
            a, b, per = C.lyrics_language(r)
            sets.append({'id': cid, 'request': cases[cid]['turns'][0]['user'], 'want': ex['lang'], 'vague': bool(ex.get('vague')), 'spare': cid == SPARE,
                         'lingua': a, 'langdetect': b, 'per': per, 'assumptions': rp.get('assumptions', []), 'message': rp['message'], 'recipe': r})
            ar = (alt.get(cid + '.t1') or {}).get('reply')
            if ar and ar.get('action') == 'recipe':
                aa, ab, _ = C.lyrics_language(ar['recipe'])
                sets[-1]['alt'] = {'lyrics': ar['recipe']['lyrics'], 'lingua': aa, 'langdetect': ab}
        else:
            sets.append({'id': cid, 'request': cases[cid]['turns'][0]['user'], 'want': ex['lang'], 'vague': bool(ex.get('vague')), 'spare': cid == SPARE,
                         'missing': True})
    data = json.dumps(sets, ensure_ascii=False)
    page = TEMPLATE.replace('/*SETS*/[]', data).replace('__SRC__', html.escape(os.path.basename(src)))
    out = os.path.join(HERE, 'lyrics.html')
    open(out, 'w', encoding='utf8').write(page)
    print('wrote', out, len(sets))


TEMPLATE = r"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>SP-5 lyrics read</title>
<style>
:root{--bg:#1c1d21;--fg:#ececec;--mut:#9a9aa3;--line:#33343b;--card:#16171a;--acc:#7b4b94;--ok:#6fbf8a;--no:#d9806a}
@media (prefers-color-scheme:light){:root{--bg:#f6f5f2;--fg:#1d1d20;--mut:#66666e;--line:#d6d4cf;--card:#ffffff;--acc:#6b3f84;--ok:#2d7a4f;--no:#b24a32}}
body{background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,sans-serif;margin:24px auto;max-width:900px;padding:0 16px}
h1{font-size:20px;margin:0 0 6px} h2{font-size:15px;margin:0;letter-spacing:.5px} .note{color:var(--mut);font-size:13px}
.set{border:1px solid var(--line);background:var(--card);padding:14px;margin:18px 0}
.meta{color:var(--mut);font-size:13px;margin:4px 0 8px}.chips span{display:inline-block;border:1px solid var(--line);padding:1px 8px;margin:0 4px 4px 0;font-size:12px}
pre{white-space:pre-wrap;font:14px/1.5 ui-monospace,Consolas,monospace;margin:6px 0 10px}.tag{color:var(--acc);font-weight:600}
.warn{color:var(--no)} .good{color:var(--ok)}
button{background:transparent;color:var(--fg);border:1px solid var(--mut);padding:6px 14px;cursor:pointer;margin:2px 6px 2px 0;font:inherit}
button.on.yes{border-color:var(--ok);color:var(--ok)}button.on.no{border-color:var(--no);color:var(--no)}
#tally{position:sticky;top:0;background:var(--bg);padding:8px 0;border-bottom:1px solid var(--line);z-index:2}
textarea{width:100%;box-sizing:border-box;background:var(--card);color:var(--fg);border:1px solid var(--line);padding:6px;font:inherit}
</style></head><body>
<h1>SP-5 · read the lyrics: is each one usable as a first take?</h1>
<p class="note">10 lyric sets written by qwen3:14b for the 10 recipe requests of the spike (3 English, 3 German, 3 Spanish, plus one spare English), one run, none picked or fixed by hand
(source: __SRC__). "Usable as a first take" = you would press CREATE SONG on it and edit from there, not that it is good poetry. Bar (d) wants 8 of 10 usable; below 8 the lyrics move to
their own call with a per-language prompt. The language the model was asked for and what the offline language-ID (lingua, langdetect) found are shown under each request.
Your marks stay in this browser (localStorage); copy the summary at the bottom to send it back.</p>
<div id="tally" class="note"></div>
<div id="sets"></div>
<h2>Your summary</h2><pre id="out"></pre><button id="copy">copy summary</button>
<script>
const SETS=/*SETS*/[];
const root=document.getElementById('sets');
let votes={};try{votes=JSON.parse(localStorage.getItem('sp5lyrics')||'{}')}catch(e){}
const save=()=>{try{localStorage.setItem('sp5lyrics',JSON.stringify(votes))}catch(e){}};
const esc=s=>String(s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
const LN={en:'English',de:'German',es:'Spanish',fr:'French',it:'Italian',pt:'Portuguese',nl:'Dutch',pl:'Polish',sv:'Swedish',tr:'Turkish',ru:'Russian',la:'Latin'};
SETS.forEach((s,i)=>{
  const d=document.createElement('div');d.className='set';
  let body;
  if(s.missing){body='<p class="warn">The model did not return a recipe for this request.</p>';}
  else{
    const r=s.recipe;
    const lyr=r.lyrics.map(x=>`<span class="tag">[${esc(x.tag)}]</span>\n${x.lines.map(esc).join('\n')}`).join('\n\n');
    const ok=s.lingua===s.want;
    body=`<div class="meta"><b>${esc(r.title)}</b> · ${esc(r.style)} · ${r.bpm} bpm · ${esc(r.key)} · ${esc(r.time_signature)} · engine ${esc(r.engine)}</div>
    <div class="chips">${r.structure.map(t=>`<span>${esc(t)}</span>`).join('')}</div>
    <div class="meta">assistant: ${esc(s.message)}${s.assumptions.length?`<br>assumptions: ${s.assumptions.map(esc).join(' · ')}`:''}</div>
    <pre>${lyr}</pre>${s.alt?`<details><summary class="note">B: the same song idea with the lyrics written in a second call (ladder rung 3), language-ID ${LN[s.alt.lingua]||s.alt.lingua}</summary><pre>${s.alt.lyrics.map(x=>`<span class="tag">[${esc(x.tag)}]</span>\n${x.lines.map(esc).join('\n')}`).join('\n\n')}</pre></details>`:''}
    <div class="meta">language-ID: lingua <b class="${ok?'good':'warn'}">${LN[s.lingua]||s.lingua}</b> · langdetect ${LN[s.langdetect]||s.langdetect} · asked for ${LN[s.want]}${ok?'':' <b class="warn">(mismatch)</b>'}</div>`;
  }
  d.innerHTML=`<h2>${i+1}. ${esc(s.request)}</h2><div class="meta">${s.id} · ${LN[s.want]} lyrics expected${s.vague?' · a deliberately vague request':''}${s.spare?' · <b>spare</b>':''}</div>${body}
  <button class="yes" data-i="${i}" data-v="usable">usable first take</button><button class="no" data-i="${i}" data-v="not usable">not usable</button>
  <input type="text" data-n="${i}" placeholder="why (optional)" style="width:50%;background:var(--card);color:var(--fg);border:1px solid var(--line);padding:5px">`;
  root.appendChild(d);
});
function paint(){
  document.querySelectorAll('button[data-v]').forEach(b=>{const v=votes[b.dataset.i];b.classList.toggle('on',v&&v.v===b.dataset.v);});
  document.querySelectorAll('input[data-n]').forEach(t=>{if(document.activeElement!==t)t.value=(votes[t.dataset.n]||{}).note||'';});
  const rows=SETS.map((s,i)=>{const v=votes[i]||{};return `${i+1}. ${s.id} ${LN[s.want]}${s.spare?' (spare)':''}: ${v.v||'(not read)'}${v.note?' — '+v.note:''}`});
  const usable=SETS.filter((s,i)=>(votes[i]||{}).v==='usable').length,read=SETS.filter((s,i)=>(votes[i]||{}).v).length;
  document.getElementById('tally').textContent=`${read} of ${SETS.length} read · ${usable} usable (bar: 8 of 10)`;
  document.getElementById('out').textContent=`SP-5 lyrics read: ${usable} of ${read} read are usable first takes\n`+rows.join('\n');
}
document.addEventListener('click',e=>{const b=e.target.closest('button[data-v]');if(!b)return;const i=b.dataset.i;votes[i]=Object.assign(votes[i]||{},{v:b.dataset.v});save();paint();});
document.addEventListener('input',e=>{const t=e.target.closest('input[data-n]');if(!t)return;const i=t.dataset.n;votes[i]=Object.assign(votes[i]||{},{note:t.value});save();paint();});
document.getElementById('copy').onclick=()=>{const t=document.getElementById('out').textContent;(navigator.clipboard?navigator.clipboard.writeText(t):Promise.reject()).catch(()=>{});};
paint();
</script></body></html>
"""

if __name__ == '__main__':
    main()
