// Drives chat edits through the real API (same endpoints as the UI) and copies v1 / v2 pairs for the listen.
import fs from 'node:fs';
import path from 'node:path';
const S = 'http://127.0.0.1:3701';
const DATA = 'E:/ai/tmp/c0b-live/data';
const OUT = 'E:/ai/tmp/c0b-live/listen';
const songs = JSON.parse(process.argv[2]); // [{id,name,text}]
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const j = async (m, u, b) => { const r = await fetch(S + u, { method: m, headers: { 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }); let body = null; try { body = await r.json(); } catch {} return { status: r.status, body }; };
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

for (const s of songs) {
  const t = (await j('GET', `/api/chat/songs/${s.id}/thread`)).body;
  const song0 = (await j('GET', `/api/songs/${s.id}`)).body;
  const v1 = song0.layers[0].versions.find((v) => v.active) ?? song0.layers[0].versions[0];
  const before = t.messages.length;
  const turn = await j('POST', `/api/chat/threads/${t.id}/turns`, { text: s.text });
  log(s.name, 'turn', turn.status);
  if (turn.status !== 202) continue;
  let edit = null, say = null;
  for (let i = 0; i < 120 && !edit && !say; i++) {
    await sleep(2000);
    const th = (await j('GET', `/api/chat/threads/${t.id}`)).body;
    const m = th.messages.slice(before).find((x) => x.role === 'assistant');
    if (m?.kind === 'edit') edit = m; else if (m) say = m;
  }
  if (!edit) { log(s.name, 'no edit card:', say?.kind, (say?.text ?? '').slice(0, 200)); continue; }
  const spl = edit.body.splice;
  log(s.name, 'card', edit.id.slice(0, 8), 'splice=', JSON.stringify(spl)?.slice(0, 160), 'ops=', JSON.stringify(edit.body.ops).slice(0, 160));
  const ap = await j('POST', `/api/chat/threads/${t.id}/apply`, { proposalId: edit.proposalId });
  log(s.name, 'apply', ap.status, JSON.stringify(ap.body));
  if (ap.status !== 202) continue;
  const t0 = Date.now();
  let ver = null;
  for (let i = 0; i < 300 && !ver; i++) {
    await sleep(3000);
    const th = (await j('GET', `/api/chat/threads/${t.id}`)).body;
    ver = th.messages.find((x) => x.kind === 'version' && x.jobId === ap.body.jobId);
    const e = th.messages.find((x) => x.id === edit.id);
    if (!ver && e && ['failed', 'cancelled'].includes(e.state)) { log(s.name, 'edit state', e.state); break; }
  }
  if (!ver) { log(s.name, 'no version'); continue; }
  const song = (await j('GET', `/api/songs/${s.id}`)).body;
  const vs = song.layers[0].versions;
  const v2 = vs.find((v) => v.id === ver.versionId) ?? vs.find((v) => v.active);
  log(s.name, 'saved in', ((Date.now() - t0) / 1000).toFixed(0), 's', ver.body.label, 'splice', JSON.stringify(ver.body.splice)?.slice(0, 200), 'fallback', ver.body.fallback, 'whole', ver.body.whole);
  const pick = (v) => fs.readdirSync(path.join(DATA, 'audio')).find((n) => n.startsWith(v.id + '.') && !/\.(abc|json)$/.test(n));
  const f1 = pick(v1), f2 = pick(v2);
  const base = s.name.replace(/[^A-Za-z0-9]+/g, '-');
  fs.copyFileSync(path.join(DATA, 'audio', f1), path.join(OUT, `${base}-v1${path.extname(f1)}`));
  fs.copyFileSync(path.join(DATA, 'audio', f2), path.join(OUT, `${base}-v2${path.extname(f2)}`));
  fs.writeFileSync(path.join(OUT, `${base}.json`), JSON.stringify({ song: s, v1: v1.id, v2: v2.id, label: ver.body.label, splice: ver.body.splice, whole: ver.body.whole, fallback: ver.body.fallback, ops: edit.body.ops, seconds: ver.body.seconds, duration: song.duration, editText: s.text }, null, 1));
  log(s.name, 'pair copied', f1, f2);
}
log('done');
