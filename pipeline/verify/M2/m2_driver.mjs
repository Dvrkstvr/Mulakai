// M2/CP3 driver: plan (real route; optional referent and REVISE) -> optional render (real route).
// usage: node m2_driver.mjs <tag> <songId> "<request>" [render] [revise]   env REFERENT='{"kind":"section",...}'
import fs from 'node:fs'; import { execFileSync } from 'node:child_process';
const [tag, songId, request, ...flags] = process.argv.slice(2);
const doRender = flags.includes('render'), doRevise = flags.includes('revise');
const S = 'http://127.0.0.1:3402', USER = 'http://127.0.0.1:3001';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const J = async (m, u, b) => { const r = await fetch(u, { method: m, headers: { 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }); const t = await r.text(); let p; try { p = JSON.parse(t); } catch { p = t; } return { status: r.status, body: p }; };
const smi = () => execFileSync('nvidia-smi', ['--query-gpu=memory.used,utilization.gpu', '--format=csv,noheader,nounits']).toString().trim();
const out = { tag, songId, request, flags, started: new Date().toISOString() };
const log = (m) => console.log(new Date().toISOString(), m);
async function waitIdle() {
  for (let i = 0; ; i++) {
    const u = await J('GET', USER + '/api/generate/active').catch(() => null);
    const [mib, util] = smi().split(',').map((x) => Number(x));
    const busy = (u && u.status === 200 && u.body?.active) || util > 40 || mib > 6000;
    if (!busy) { out.idleCheck = { user: u ? u.body : 'unreachable', mib, util }; return; }
    if (i % 5 === 0) log(`busy: ${JSON.stringify(u?.body)} mib ${mib} util ${util}; waiting`);
    await sleep(4000);
  }
}
await waitIdle();
out.scoreBefore = (await J('GET', `${S}/api/songs/${songId}/score`)).body;
const body = { request };
if (process.env.REFERENT) body.referent = JSON.parse(process.env.REFERENT);
if (doRevise) { const cur = (await J('GET', `${S}/api/songs/${songId}/score/plan`)).body; out.priorPlan = cur.plan; body.revise = cur.plan?.id; }
const t0 = Date.now(); out.t0 = t0;
const post = await J('POST', `${S}/api/songs/${songId}/score/plan`, body);
log(`plan POST ${post.status} ${JSON.stringify(post.body).slice(0, 300)}`);
out.post = post; out.postBody = body;
let got;
while (post.status === 202) { await sleep(250); got = (await J('GET', `${S}/api/songs/${songId}/score/plan`)).body; if (got?.run && !['queued', 'loading', 'running'].includes(got.run.status)) break; }
out.t1 = Date.now(); out.planWallS = (out.t1 - t0) / 1000; out.planGet = got;
await sleep(1500);
log(`plan ${got?.run?.status} ${out.planWallS.toFixed(1)}s attempts ${got?.plan?.attempts ?? got?.run?.attempts}`);
log(JSON.stringify(got).slice(0, 2500));
if (doRender && got?.plan) {
  await waitIdle();
  const r0 = Date.now(); out.render = { t0: r0 };
  const rp = await J('POST', `${S}/api/songs/${songId}/score/render`, { planId: got.plan.id });
  out.render.post = rp; log(`render POST ${rp.status} ${JSON.stringify(rp.body)}`);
  let run;
  while (rp.status === 202) { await sleep(2000); run = (await J('GET', `${S}/api/songs/${songId}/score/render`)).body.run; if (run && !['queued', 'loading', 'running'].includes(run.status)) break; }
  out.render.t1 = Date.now(); out.render.wallS = (out.render.t1 - r0) / 1000; out.render.run = run;
  log(`render ${run?.status} ${out.render.wallS.toFixed(0)}s ${JSON.stringify(run)}`);
  out.scoreAfter = (await J('GET', `${S}/api/songs/${songId}/score`)).body;
}
fs.writeFileSync(new URL(`./raw/run-${tag}.json`, import.meta.url), JSON.stringify(out, null, 1));
