// joins each REVISE press (rr-*.json) with the Ollama chat calls in its time window (proxy-trace.jsonl)
import fs from 'node:fs';
const L = fs.readFileSync('raw/proxy-trace.jsonl', 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const chat = L.filter((x) => x.path?.startsWith('/v1/chat'));
const gen = L.filter((x) => x.path?.startsWith('/api/generate'));
const sum = (o) => o.op === 'REHARMONIZE' ? `REHARMONIZE ${o.from_bar}-${o.to_bar} (${o.chords?.length}ch)` : o.op === 'REPEAT' || o.op === 'CUT' ? `${o.op} S${o.section}` : o.op === 'REWRITE_LYRICS' ? `REWRITE b${o.block}` : o.op === 'TRANSPOSE' ? `TRANSPOSE ${o.semitones}` : o.op === 'SET_TEMPO' ? `SET_TEMPO ${o.bpm}` : o.op;
const rows = [];
for (const f of fs.readdirSync('raw').filter((f) => /^rr-.*\.json$/.test(f))) {
  const d = JSON.parse(fs.readFileSync('raw/' + f)); 
  for (const r of d.out) { if (!r.revise || r.skipped) continue;
    const calls = chat.filter((x) => x.t0 >= r.t0 - 100 && x.t1 <= r.t1 + 300);
    const unl = L.filter((x) => x.t0 >= r.t0 - 100 && x.t1 <= r.t1 + 3000 && x.path?.startsWith('/api/generate') && x.req?.keep_alive === 0);
    const att = calls.map((c) => {
      const first = c.nonSystem[0].content; const pi = first.indexOf('PENDING PLAN'); const pend = {};
      for (const m of first.slice(pi).matchAll(/^op (\d+) (\w+) (\{.*?\})(?:: |$)/gm)) { try { pend[m[1]] = { op: m[2], ...JSON.parse(m[3]) }; } catch { /* long */ } }
      let rep; try { rep = JSON.parse(c.reply); } catch { rep = null; }
      const ops = rep?.ops ?? []; const echo = ops.length > 0 && ops.every((o) => Object.values(pend).some((p) => JSON.stringify(p) === JSON.stringify(o)));
      return { ct: c.usage?.completion_tokens, pt: c.usage?.prompt_tokens, ms: c.t1 - c.t0, drop: rep?.drop, ops: ops.map(sum), echo, valid: !!rep, pendingOps: Object.values(pend).map(sum), feedback: c.nonSystem.length > 1 ? c.nonSystem[c.nonSystem.length - 1].content.split('\n').slice(0, 3).join(' | ').slice(0, 400) : null };
    });
    rows.push({ file: f, n: r.n, song: r.song, req: r.req, status: r.run?.status, attempts: r.attempts, wallS: r.wallS, calls: att.length, unloads: unl.length, psEmptyMs: r.psEmptyAfterDoneMs, planOps: r.plan?.ops, marks: r.plan?.marks, removed: r.plan?.removed, keptPlan: r.planStillPendingAfter?.ops, reasons: r.run?.reasons, att });
  }
}
fs.writeFileSync('raw/analysis.json', JSON.stringify(rows, null, 1));
for (const r of rows) {
  console.log(`[${r.file} #${r.n}] ${r.song} "${r.req}" -> ${r.status} attempts ${r.attempts} calls ${r.calls} unload ${r.unloads} psEmpty ${r.psEmptyMs}ms ${r.wallS}s`);
  console.log(`   plan ${JSON.stringify(r.planOps)} marks ${JSON.stringify(r.marks)} removed ${JSON.stringify(r.removed)}${r.status !== 'done' ? ' FAILED ' + JSON.stringify(r.reasons) + ' kept ' + JSON.stringify(r.keptPlan) : ''}`);
  r.att.forEach((a, i) => console.log(`   att${i + 1}: ${a.ct}tok ${a.ms}ms drop ${JSON.stringify(a.drop)} ops ${JSON.stringify(a.ops)} echo=${a.echo}${a.feedback ? '\n        feedback: ' + a.feedback : ''}`));
}
