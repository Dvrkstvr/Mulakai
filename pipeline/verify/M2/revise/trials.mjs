// M2 F-033 re-check driver (verifier). usage: node trials.mjs <tag> '<json steps>'
// step = {song, req, revise?:bool}  -> POST /score/plan (revise = the song's pending plan id), poll, wait /api/ps empty, record.
import fs from 'node:fs'; import { execFileSync } from 'node:child_process';
const [tag, stepsJson] = process.argv.slice(2); const steps = JSON.parse(stepsJson);
const S = 'http://127.0.0.1:3402', USER = 'http://127.0.0.1:3001', OLL = 'http://127.0.0.1:11435';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const J = async (m, u, b) => { const r = await fetch(u, { method: m, headers: { 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }); const t = await r.text(); let p; try { p = JSON.parse(t); } catch { p = t; } return { status: r.status, body: p }; };
const smi = () => execFileSync('nvidia-smi', ['--query-gpu=memory.used,utilization.gpu', '--format=csv,noheader,nounits']).toString().trim().split(',').map(Number);
async function waitIdle() { for (let i = 0; ; i++) { const u = await J('GET', USER + '/api/generate/active').catch(() => null); const [mib, util] = smi(); const busy = (u && u.status === 200 && u.body?.active) || util > 40 || mib > 6000; if (!busy) return { user: u ? u.body : 'unreachable', mib, util }; if (i % 5 === 0) console.log('busy; waiting', mib, util); await sleep(4000); } }
const tgt = (o) => o.op === 'REHARMONIZE' ? `${o.op} ${o.from_bar}-${o.to_bar} (${o.chords?.length} chords)` : o.op === 'REPEAT' || o.op === 'CUT' ? `${o.op} S${o.section} ${o.label}` : o.op === 'REWRITE_LYRICS' ? `${o.op} b${o.block} ${o.tag}#${o.occurrence}` : o.op === 'TRANSPOSE' ? `${o.op} ${o.semitones}` : o.op === 'SET_TEMPO' ? `${o.op} ${o.bpm}` : o.op;
const out = [];
for (const [i, st] of steps.entries()) {
 for (let tryN = 0; tryN <= (st.retry ?? 0); tryN++) {
  const idle = await waitIdle();
  const base = `${S}/api/songs/${st.song}/score`;
  const prior = (await J('GET', base + '/plan')).body;
  if (st.revise && !prior.plan) { console.log('SKIP no pending plan:', st.req); out.push({ n: i + 1, skipped: true, req: st.req }); continue; }
  const body = { request: st.req }; if (st.revise) body.revise = prior.plan?.id;
  const t0 = Date.now(); const post = await J('POST', base + '/plan', body);
  let got = null; while (post.status === 202) { await sleep(250); got = (await J('GET', base + '/plan')).body; if (got?.run && !['queued', 'loading', 'running'].includes(got.run.status)) break; }
  const t1 = Date.now();
  let psEmptyMs = null; for (let k = 0; k < 100; k++) { const ps = await (await fetch(OLL + '/api/ps')).json(); if (!(ps.models || []).length) { psEmptyMs = Date.now() - t1; break; } await sleep(100); }
  const after = (await J('GET', base + '/plan')).body; // is a plan still pending?
  const p = got?.plan;
  const rec = { n: i + 1, tag, song: st.song.slice(0, 8), req: st.req, revise: !!st.revise, postStatus: post.status, postBody: post.status === 202 ? undefined : post.body, t0, t1, wallS: (t1 - t0) / 1000, idle,
    run: got?.run && { status: got.run.status, reasons: got.run.reasons, cause: got.run.cause }, attempts: p?.attempts ?? got?.run?.attempts, refusals: p?.refusals,
    pendingBefore: prior.plan && { id: prior.plan.id.slice(0, 8), ops: prior.plan.ops.map(tgt) },
    plan: p && { id: p.id.slice(0, 8), revision: p.revision, ops: p.ops.map(tgt), marks: p.since?.marks?.map((m) => m.mark), removed: p.since?.removed?.map(tgt), verdictsOk: p.verdicts?.map((v) => v.ok), checks: p.checks },
    psEmptyAfterDoneMs: psEmptyMs, planStillPendingAfter: after.plan ? { id: after.plan.id.slice(0, 8), ops: after.plan.ops.map(tgt) } : null };
  out.push(rec); console.log(JSON.stringify(rec).slice(0, 1800));
  fs.writeFileSync(new URL(`./raw/rr-${tag}.json`, import.meta.url), JSON.stringify({ steps, out, full: got }, null, 1));
  await sleep(500);
  if (st.revise || rec.run?.status === 'done') break;
 }
}
