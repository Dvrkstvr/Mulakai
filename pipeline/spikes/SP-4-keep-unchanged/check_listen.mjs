// SP-4: load the listen page in Chromium (Playwright from e2e/), report console errors, check every pair's timelines and that the A/B switch keeps place.
import { createRequire } from 'node:module';
const require = createRequire('E:/repos/Mulakai/e2e/package.json');
const { chromium } = require('@playwright/test');
const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1100, height: 900 } });
const errs = []; pg.on('console', m => { if (m.type() === 'error') errs.push(m.text()); }); pg.on('pageerror', e => errs.push('pageerror ' + e.message));
await pg.goto('http://127.0.0.1:8077/index.html'); await pg.waitForTimeout(4000);
const rows = await pg.evaluate(async () => {
  const out = [];
  for (const p of PAIRS) {
    const A = document.getElementById(`au_${p.id}_A`), B = document.getElementById(`au_${p.id}_B`);
    const row = { id: p.id, cand: p.candidate, durA: +A.duration.toFixed(1), durB: +B.duration.toFixed(1), nbarsO: p.barsOrig.length - 1, nbarsE: p.barsEdit.length - 1 };
    const take = { A: p.edited === 'A' ? 'edit' : 'orig' };
    // times in the original, map to edited, map back
    const t = p.barsOrig[Math.floor(p.barsOrig.length / 3)];
    const e = mapT(p.fwd, t), back = mapT(p.bwd, e);
    row.fwdBack = [+t.toFixed(2), +e.toFixed(2), +back.toFixed(2)];
    row.jumpsOk = p.jumps.every(j => j.slice(1).every(x => isFinite(x)));
    row.durMatch = [Math.abs((p.edited === 'A' ? A.duration : B.duration) - p.barsEdit[p.barsEdit.length - 1]) < 0.3, Math.abs((p.edited === 'A' ? B.duration : A.duration) - p.barsOrig[p.barsOrig.length - 1]) < 0.3];
    out.push(row);
  }
  return out;
});
for (const r of rows) console.log(JSON.stringify(r));
const bad = rows.filter(r => !r.jumpsOk || !r.durMatch[0] || !r.durMatch[1]);
console.log('pairs', rows.length, 'with a problem', bad.map(r => r.id));
await pg.click('#R_p16'); await pg.waitForTimeout(300);
await pg.evaluate(() => document.getElementById('S_p16').scrollIntoView());
await pg.screenshot({ path: 'E:/ai/tmp/sp4/listen_shot2.png' });
console.log('errors', errs.slice(0, 5));
await b.close();
