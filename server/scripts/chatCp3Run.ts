/**
 * CP-C3-ONLY HTTP steps for chatCp3.ts (not app code, never imported by src/): NEW CHAT, attach (a
 * library pick or a file), the turn that should answer an analyze card, READ -> the reading (its step
 * times from the job's progress text) -> the follow-up turn the server queues (D-129) and its recipe's
 * `reference_use`. Reuses chatCp0Run's job follower and scoreCp1Lib's proxy log / GPU samples.
 */
import fs from 'node:fs';
import path from 'node:path';
import { coverVerdict, isRead, type Reading } from '../src/services/chat/reading.js';
import { follow, thread, type Msg, type RunCtx } from './chatCp0Run.js';
import { plannerWindow } from './chatCp0Stats.js';
import { plannerOnGpu, stepDurations, type FollowRecord, type Progress, type PsSample, type ReadingRecord } from './chatCp3Stats.js';
import { gpuAt, json, now, sleep } from './scoreCp1Lib.js';

export interface Cp3Ctx extends RunCtx { ps: PsSample[]; readTimeoutMs: number }
const REPLY = ['recipe', 'ask', 'say', 'failed', 'analyze', 'edit'];
const replyAfter = (msgs: Msg[], seq: number) => msgs.slice(seq + 1).find((m) => m.role === 'assistant' && REPLY.includes(m.kind)) ?? null;

export async function newChat(ctx: Cp3Ctx): Promise<string> {
  const r = await json('POST', `${ctx.server}/api/chat/draft/reset`);
  if (r.status !== 200) throw new Error(`NEW CHAT refused ${r.status}: ${JSON.stringify(r.body)}`);
  return r.body.id as string;
}

export interface Attached { status: number; ms: number; referenceId: string | null; reason: string | null; name: string | null }
export async function attach(ctx: Cp3Ctx, threadId: string, src: { songId?: string; file?: string; name?: string }): Promise<Attached> {
  const base = `${ctx.server}/api/chat/threads/${threadId}/references`;
  let r: { status: number; body: any; ms: number };
  if (src.songId) r = await json('POST', `${base}/library`, { songId: src.songId });
  else {
    const t0 = now();
    const form = new FormData();
    form.append('audio', new Blob([fs.readFileSync(src.file!)]), src.name ?? path.basename(src.file!));
    const res = await fetch(base, { method: 'POST', body: form });
    r = { status: res.status, body: await res.json().catch(() => null), ms: now() - t0 };
  }
  return { status: r.status, ms: r.ms, referenceId: r.body?.reference?.id ?? null, reason: r.body?.reason ?? null, name: r.body?.reference?.name ?? null };
}

/** SEND (with the attach) and the reply; `proposalId` is the analyze card's. */
export async function ask(ctx: Cp3Ctx, threadId: string, text: string, referenceId: string | null) {
  const t0 = now();
  const post = await json('POST', `${ctx.server}/api/chat/threads/${threadId}/turns`, { text, clientKey: `cp3-${t0}`, ...(referenceId ? { attach: { referenceId } } : {}) });
  if (post.status !== 202) return { action: `refused ${post.status}`, turnMs: null, reasons: [JSON.stringify(post.body)], proposalId: null };
  const f = await follow(ctx, post.body.jobId, ctx.turnTimeoutMs);
  const msgs = (await thread(ctx, threadId)).messages;
  const reply = replyAfter(msgs, msgs.findIndex((m) => m.id === post.body.messageId));
  const body = (reply?.body ?? {}) as { reasons?: string[] };
  return { action: reply?.kind ?? (f.timedOut ? 'timeout' : null), turnMs: f.endAt - t0, reasons: body.reasons ?? (reply?.kind === 'say' ? [reply.text] : []), proposalId: reply?.proposalId ?? null };
}

function describe(reading: Reading | null) {
  if (!reading) return { words: 'no reading', score: 'no reading', caption: 'no reading', scoreOk: false, coverable: 'no reading' };
  const w = reading.words; const s = reading.score; const c = reading.caption;
  const nr = (p: object) => `not read: ${(p as { notRead: string }).notRead}`;
  const tokens = isRead(s) && s.measure ? `${s.measure.header + s.measure.sections.reduce((n, x) => n + x.tokens, 0)}/${s.measure.budget} tok` : 'unmeasured';
  const v = coverVerdict(reading);
  return {
    words: isRead(w) ? `${w.language ?? '?'}, ${w.lines.length} lines${w.instrumental ? ', instrumental' : ''}` : nr(w),
    score: isRead(s) ? `${s.source}, ${s.facts ? `${s.facts.header.bars} bars, ${s.facts.sections.length} sections, ${s.facts.header.bpm} bpm ${s.facts.header.key} ${s.facts.header.meter}` : 'does not parse'}, chords ${s.chords}, ${s.warnings.length} warnings, ${tokens}` : nr(s),
    caption: isRead(c) ? `${c.bpm ?? '?'} bpm, ${c.key ?? '?'}, ${c.meter ?? '?'}: ${c.caption.slice(0, 60)}` : nr(c),
    scoreOk: isRead(s) && s.facts !== null, coverable: v.ok ? 'yes' : v.reason,
  };
}

/** The model's own `reference_use` in the window's last planner reply (the card's recipe is code's, after referenceRecipe). */
function lastUse(ctx: Cp3Ctx, from: number, to: number): string | null {
  const last = ctx.events.filter((e) => e.path.startsWith('/v1/chat') && e.t0 >= from && e.t1 <= to + 50).at(-1);
  try { return JSON.parse(String(last?.info.content ?? '')).recipe?.reference_use ?? null; } catch { return null; }
}

/** READ on the analyze card -> the reading -> the follow-up turn and its reply. */
export async function readAndFollow(ctx: Cp3Ctx, threadId: string, proposalId: string): Promise<{ reading: ReadingRecord; followUp: FollowRecord | null; recipeId: string | null }> {
  const press = now();
  const post = await json('POST', `${ctx.server}/api/chat/threads/${threadId}/read`, { proposalId });
  const empty = { WORDS: null, SCORE: null, CAPTION: null };
  if (post.status !== 202) {
    return { reading: { jobId: '', status: `refused ${post.status}`, error: JSON.stringify(post.body), handoffMs: null, readingMs: null, steps: empty, seconds: null, readTo: null, plan: null, ...describe(null) }, followUp: null, recipeId: null };
  }
  const jobId = post.body.jobId as string;
  const progress: Progress[] = [];
  const f = await follow(ctx, jobId, ctx.readTimeoutMs, (j) => { if (j.progressText) progress.push({ t: now(), text: String(j.progressText) }); });
  const done = f.endAt;
  ctx.log(`  reading ${jobId.slice(0, 8)}: ${f.last?.status ?? 'gone'} in ${((done - (f.runningAt ?? press)) / 1000).toFixed(1)} s ${f.last?.error ? `(${f.last.error})` : ''}`);
  let msgs = (await thread(ctx, threadId)).messages;
  let card = msgs.filter((m) => m.kind === 'reading').at(-1);
  for (let i = 0; i < 300 && card && card.jobId === jobId; i++) { // the reading card's job id moves to the follow-up turn
    await sleep(100);
    msgs = (await thread(ctx, threadId)).messages;
    card = msgs.filter((m) => m.kind === 'reading').at(-1);
  }
  const r = (card?.body?.reading ?? null) as Reading | null;
  const reading: ReadingRecord = {
    jobId, status: String(f.last?.status ?? 'gone'), error: f.last?.error ? String(f.last.error) : null,
    handoffMs: f.runningAt === null ? null : f.runningAt - press, readingMs: f.runningAt === null ? null : done - f.runningAt,
    steps: stepDurations(progress, done), seconds: r?.seconds ?? null, readTo: r?.readTo ?? null, plan: r ? { ...r.plan } : null, ...describe(r),
  };
  const fuJob = card && card.jobId !== jobId ? card.jobId : null;
  if (!fuJob) return { reading, followUp: null, recipeId: null };
  const vramBeforeMiB = gpuAt(ctx.gpu, done)?.mib ?? null;
  const g = await follow(ctx, fuJob, ctx.turnTimeoutMs);
  await sleep(250);
  msgs = (await thread(ctx, threadId)).messages;
  const reply = replyAfter(msgs, msgs.findIndex((m) => m.id === card!.id));
  const body = (reply?.body ?? {}) as { recipe?: { reference_use?: string }; reference?: { use: string; borrowed: string[]; missing: string[]; note: string | null }; reasons?: string[]; cause?: string };
  // The follow-up can start inside the last 100 ms poll of the reading, so the planner window opens at READ.
  const win = plannerWindow(ctx.events, press, g.endAt);
  const gpu = plannerOnGpu(ctx.ps, press, g.endAt);
  const modelUse = lastUse(ctx, press, g.endAt);
  return {
    reading,
    followUp: {
      jobId: fuJob, action: reply?.kind ?? (g.timedOut ? 'timeout' : null), cause: body.cause ?? null, reasons: body.reasons ?? (reply?.kind === 'say' || reply?.kind === 'ask' ? [reply.text] : []),
      handoffMs: g.runningAt === null ? null : g.runningAt - done, turnMs: g.endAt - done, promptTokens: win.promptTokens, unloadMs: win.unloadMs,
      vramBeforeMiB, plannerOnGpu: gpu.on, plannerVram: gpu.vram, referenceUse: modelUse ?? body.recipe?.reference_use ?? null, finalUse: body.reference?.use ?? null,
      borrowed: body.reference?.borrowed ?? [], missing: body.reference?.missing ?? [], note: body.reference?.note ?? null,
    },
    recipeId: reply?.kind === 'recipe' ? reply.proposalId : null,
  };
}

/** Ollama's own /api/ps every 500 ms (the planner's VRAM residency, R-028). */
export function startPsSampler(ollama: string, out: PsSample[]): () => void {
  let stop = false;
  void (async () => {
    while (!stop) {
      const r = await json('GET', `${ollama}/api/ps`, undefined, 3000).catch(() => null);
      if (r?.status === 200) out.push({ t: now(), models: (r.body.models ?? []).map((m: { name: string; size: number; size_vram: number }) => ({ name: m.name, size: m.size, size_vram: m.size_vram })) });
      await sleep(500);
    }
  })();
  return () => { stop = true; };
}
