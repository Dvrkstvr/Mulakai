// Builds E:/ai/tmp/c0b-live/listen/index.html from the pair JSONs (template: SP-4 listen page).
import fs from 'node:fs';
import path from 'node:path';
const DIR = 'E:/ai/tmp/c0b-live/listen';
const TPL = 'E:/repos/Mulakai/.claude/worktrees/docs-c3/pipeline/spikes/SP-4-keep-unchanged/listen_template.html';
const S = 'http://127.0.0.1:3701';
let html = fs.readFileSync(TPL, 'utf8');
const pairs = [];
const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.json') && f !== 'pairs.json').sort();
let n = 0;
for (const f of files) {
  const j = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
  const base = f.replace(/\.json$/, '');
  const v1 = fs.readdirSync(DIR).find((x) => x.startsWith(base + '-v1.'));
  const v2 = fs.readdirSync(DIR).find((x) => x.startsWith(base + '-v2.'));
  if (!v1 || !v2) continue;
  // bars: the edit card's check (bars) from the thread; falls back to 4 s per bar
  let nbars = 0;
  try {
    const th = await (await fetch(`${S}/api/chat/songs/${j.song.id}/thread`)).json();
    const ver = th.messages.find((m) => m.kind === 'version' && m.versionId === j.v2);
    const ed = th.messages.find((m) => m.kind === 'edit' && ver && m.jobId === ver.jobId);
    nbars = ed?.body?.checks?.bars ?? 0;
  } catch {}
  const D = j.duration;
  if (!nbars) nbars = Math.round(D / 2.5);
  const bar = D / nbars;
  const bt = Array.from({ length: nbars + 1 }, (_, i) => +(i * bar).toFixed(3));
  const [from, to] = j.splice?.bars ?? [1, nbars];
  const label = j.whole ? 'whole song re-rendered' : j.splice ? `${j.splice.kind} bars ${from}-${to}` : `bars ${from}-${to}`;
  n++;
  const editedIsA = n % 2 === 0; // alternate so the order is not a tell
  pairs.push({
    id: base, n, title: `${base.replace(/-/g, ' ')}: "${(j.editText ?? j.song.text)}"`,
    hint: `${label}. ${j.whole ? 'Every bar is new, so the shading covers the song.' : 'Only the shaded bars were re-sung; the rest is the old audio.'} Bar lines are even (song length / ${nbars} bars), so they are approximate.`,
    edited: editedIsA ? 'A' : 'B', orig: v1, edit: v2, barsOrig: bt, barsEdit: bt,
    shadeOrig: [[from, to, 'edited bars']], shadeEdit: [[from, to, 'edited bars']],
    fwd: [[0, D, 0, D]], bwd: [[0, D, 0, D]],
    jumps: [[`bar ${from} (start of the edit)`, bt[Math.max(0, from - 2)], bt[Math.max(0, from - 2)]], [`bar ${to + 1} (just after)`, bt[Math.min(nbars - 1, to - 1)], bt[Math.min(nbars - 1, to - 1)]]],
    seams: [bt[from - 1], bt[Math.min(nbars, to)]],
    qEdit: 'In the shaded bars, did the chords change (jazzier, different roots)?',
    revealText: `${label}; label "${j.label}".`, candidate: base,
  });
}
html = html.replace('/*PAIRS*/[]', JSON.stringify(pairs));
html = html.replace('<title>SP-4 listen: keep the unchanged parts</title>', '<title>C0b listen: chat edits, before and after</title>');
html = html.replace(/<h1>.*?<\/h1>/, `<h1>C0b listen: does a chat edit keep the rest and change the chords? (<span id="npairs"></span> pairs)</h1>`);
html = html.replace(/<p class="note">Local files only[\s\S]*?<\/p>/, '<p class="note">Serve this folder (<code>cd E:/ai/tmp/c0b-live/listen &amp;&amp; npx http-server . -p 8078</code>, open http://localhost:8078/index.html); a plain file open cannot seek. Each pair is one song before (v1) and after (v2) one chat edit, in random order (A or B is the edited one; you are not told). Press A or B while playing: the switch keeps the same place in the music. Click or drag the timeline, arrow keys move one bar, jump buttons start one bar before the spot. Answer the three questions, then press reveal to see which was edited and where the joins are (red). The pass line (F-050 #3): join not found in 4 of 5, "the rest sounds the same" yes, "the chords changed" yes.</p>');
fs.writeFileSync(path.join(DIR, 'index.html'), html);
console.log('pairs', pairs.length, pairs.map((p) => p.id + ':' + p.edited));
