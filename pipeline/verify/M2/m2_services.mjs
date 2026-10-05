// M2/CP3 recording side-car (verifier). Ollama timing proxy :11436 -> :11435 (keeps usage, reply text, and every non-system
// message of each chat call = the retry feedback), yue-server proxy :8034 -> :8024 (keeps job JSON snapshots), /api/ps poller 100 ms.
import http from 'node:http'; import fs from 'node:fs';
const dir = new URL('./raw/', import.meta.url);
const tr = fs.createWriteStream(new URL('./proxy-trace.jsonl', dir), { flags: 'a' });
const ps = fs.createWriteStream(new URL('./ps-trace.jsonl', dir), { flags: 'a' });
const yj = fs.createWriteStream(new URL('./yue-trace.jsonl', dir), { flags: 'a' });
function proxy(port, target, onDone) {
  http.createServer(async (req, res) => {
    const chunks = []; for await (const c of req) chunks.push(c);
    const body = Buffer.concat(chunks); const t0 = Date.now(); const ac = new AbortController(); res.on('close', () => { if (!res.writableEnded) ac.abort(); });
    try {
      const r = await fetch(target + req.url, { method: req.method, headers: { 'content-type': req.headers['content-type'] || 'application/json' }, body: ['GET','HEAD'].includes(req.method) ? undefined : body, signal: AbortSignal.any([ac.signal, AbortSignal.timeout(900000)]) });
      const buf = Buffer.from(await r.arrayBuffer());
      onDone({ t0, t1: Date.now(), method: req.method, path: req.url, status: r.status, req: body, res: buf });
      res.writeHead(r.status, { 'content-type': r.headers.get('content-type') || 'application/json' }); res.end(buf);
    } catch (e) { onDone({ t0, t1: Date.now(), method: req.method, path: req.url, status: 502, err: String(e) }); res.writeHead(502); res.end(String(e)); }
  }).listen(port, '127.0.0.1');
}
const J = (b) => { try { return JSON.parse(b.toString()); } catch { return null; } };
proxy(11436, 'http://127.0.0.1:11435', (e) => {
  const q = e.req && J(e.req), r = e.res && J(e.res); const o = { t0: e.t0, t1: e.t1, method: e.method, path: e.path, status: e.status, err: e.err };
  if (e.path.startsWith('/v1/chat')) { o.usage = r?.usage; o.reply = r?.choices?.[0]?.message?.content; o.nonSystem = (q?.messages ?? []).filter((m) => m.role !== 'system'); o.systemChars = (q?.messages ?? []).filter((m) => m.role === 'system').reduce((a, m) => a + m.content.length, 0); o.model = q?.model; o.keep_alive = q?.keep_alive; }
  else if (e.path.startsWith('/api/generate')) { o.req = q; o.res = r; }
  else if (e.path.startsWith('/api/ps')) o.models = (r?.models ?? []).map((m) => ({ name: m.name, ctx: m.context_length, size_vram: m.size_vram, size: m.size }));
  tr.write(JSON.stringify(o) + '\n');
});
proxy(8034, 'http://127.0.0.1:8024', (e) => {
  if (!/^\/v1\/jobs/.test(e.path)) return;
  const r = e.res && J(e.res);
  if (e.method === 'POST' && e.path === '/v1/jobs') { yj.write(JSON.stringify({ t0: e.t0, t1: e.t1, method: 'POST', path: e.path, status: e.status, id: r?.id, body: J(e.req) }) + '\n'); return; }
  if (r && (r.status === 'succeeded' || r.status === 'truncated' || r.status === 'failed' || r.status === 'cancelled')) yj.write(JSON.stringify({ t0: e.t0, t1: e.t1, path: e.path, job: r }) + '\n');
});
let last = '';
setInterval(async () => {
  const t = Date.now();
  try { const j = await (await fetch('http://127.0.0.1:11435/api/ps')).json(); const k = (j.models || []).map((m) => m.name + ':' + m.size_vram + ':' + m.context_length).join(',');
    if (k !== last) { ps.write(JSON.stringify({ t, models: k }) + '\n'); last = k; } } catch (e) { if (last !== 'ERR') { ps.write(JSON.stringify({ t, err: String(e) }) + '\n'); last = 'ERR'; } }
}, 100);
console.log('m2 services up');
