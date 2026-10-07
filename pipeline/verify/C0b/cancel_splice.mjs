// F-049: CANCEL while SPLICING, via the API the UI uses. Prints the job phases, the cancel result and the final state.
import { execSync } from 'node:child_process';
const S = 'http://127.0.0.1:3701';
const songId = process.argv[2], text = process.argv[3];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const j = async (m, u, b) => { const r = await fetch(S + u, { method: m, headers: { 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }); let body = null; try { body = await r.json(); } catch {} return { status: r.status, body }; };
const log = (...a) => console.log(new Date().toISOString().slice(11, 23), ...a);
const wslLs = () => execSync(`wsl.exe -d Ubuntu-24.04 --exec bash -lc "ls ~/yue-data | tr '\\n' ' '; echo; ls ~/yue-data/splice-uploads | wc -l"`, { encoding: 'utf8' }).trim().replace(/\0/g, '');
const t = (await j('GET', `/api/chat/songs/${songId}/thread`)).body;
const before = t.messages.length;
const vBefore = (await j('GET', `/api/songs/${songId}`)).body.layers[0].versions.length;
log('yue-data before:', wslLs());
await j('POST', `/api/chat/threads/${t.id}/turns`, { text });
let edit = null;
for (let i = 0; i < 90 && !edit; i++) { await sleep(2000); const th = (await j('GET', `/api/chat/threads/${t.id}`)).body; edit = th.messages.slice(before).find((m) => m.role === 'assistant' && m.kind === 'edit'); if (!edit && th.messages.slice(before).some((m) => m.role === 'assistant')) { log('no edit card'); process.exit(1); } }
log('card', edit.body.splice);
const ap = await j('POST', `/api/chat/threads/${t.id}/apply`, { proposalId: edit.proposalId });
log('apply', ap.status, JSON.stringify(ap.body));
const jobId = ap.body.jobId;
let last = '', cancelled = false;
for (let i = 0; i < 2000; i++) {
  const r = await j('GET', `/api/generate/${jobId}`);
  const s = `${r.body.status} | ${r.body.progressText ?? ''} | ${r.body.progressStage ?? ''}`;
  if (s !== last) { last = s; log('job:', s); }
  if (!cancelled && /splic/i.test(s)) { const c = await j('POST', `/api/chat/jobs/${jobId}/cancel`); log('CANCEL while splicing ->', c.status, JSON.stringify(c.body)); cancelled = true; }
  if (['done', 'failed', 'cancelled'].includes(r.body.status)) break;
  await sleep(250);
}
await sleep(2500);
const th = (await j('GET', `/api/chat/threads/${t.id}`)).body;
const card = th.messages.find((m) => m.id === edit.id);
const vAfter = (await j('GET', `/api/songs/${songId}`)).body.layers[0].versions.length;
log('edit card state:', card.state, 'phase:', card.phase, 'versions before/after:', vBefore, vAfter, 'version msg:', th.messages.some((m) => m.kind === 'version' && m.jobId === jobId));
log('cancelled=', cancelled);
log('yue-data after:', wslLs());
