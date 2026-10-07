/**
 * CP-C1-ONLY HTTP steps for chatCp1.ts (not app code, never imported by src/): the song's analysis view and job
 * (followed in the background, step times from its progress text), a turn sent now and read later (so one can
 * queue behind an APPLY or an analysis), APPLY and its wait, and the marks built from the strip as the client
 * would. Reuses chatCp0Run's job follower, chatCp3's /api/ps samples and scoreCp1Lib's proxy log and GPU samples.
 */
import Database from 'better-sqlite3';
import path from 'node:path';
import { follow, thread, type Msg } from './chatCp0Run.js';
import { plannerWindow } from './chatCp0Stats.js';
import type { Cp3Ctx } from './chatCp3Run.js';
import { plannerOnGpu, type Progress } from './chatCp3Stats.js';
import { analysisSteps, markBarsOf, opsOutside, type AnalysisRecord, type MarkSent, type TurnRecord } from './chatCp1Stats.js';
import { gpuAfter, gpuAt, json, now, sleep } from './scoreCp1Lib.js';

export interface Ctx extends Cp3Ctx { dataDir: string }
type Bars = [number, number];
export interface Section { index: number; label: string; occurrence: number; bars: Bars; seconds: Bars | null }
export interface View { versionId: string | null; number: number | null; state: { kind: string; jobId?: string }; shown: { mode: string; transcribed: boolean; bars: { starts: number[]; end: number } | null; sections: Section[]; notRead: Record<string, string | null> } | null }

export const view = async (ctx: Ctx, songId: string) => (await json('GET', `${ctx.server}/api/chat/songs/${songId}/analysis`)).body as View;

function db<T>(ctx: Ctx, fn: (d: Database.Database) => T): T {
  const d = new Database(path.join(ctx.dataDir, 'mulakai.db'), { readonly: true, fileMustExist: true });
  try { return fn(d); } finally { d.close(); }
}
const songSeconds = (ctx: Ctx, songId: string) => db(ctx, (d) => (d.prepare(`SELECT duration FROM songs WHERE id = ?`).get(songId) as { duration: number | null } | undefined)?.duration ?? null);
const stored = (ctx: Ctx, versionId: string) => db(ctx, (d) => (d.prepare(`SELECT analysis_json FROM versions WHERE id = ?`).get(versionId) as { analysis_json: string | null } | undefined)?.analysis_json ?? null);

/** The score facts of the song's newest analyzed base version (the outside judge's sections and lyric blocks). */
export function factsOf(ctx: Ctx, songId: string) {
  const rows = db(ctx, (d) => d.prepare(`SELECT v.analysis_json FROM versions v JOIN layers l ON l.id = v.layer_id WHERE l.song_id = ? AND l.kind = 'base' AND v.analysis_json IS NOT NULL ORDER BY v.created_at DESC`).all(songId) as Array<{ analysis_json: string }>);
  for (const r of rows) { const f = JSON.parse(r.analysis_json)?.score?.facts; if (f) return f; }
  return null;
}

/** The song's next analysis job (not `notJob`), waiting up to 15 s for the trigger. */
export async function findAnalysis(ctx: Ctx, songId: string, notJob: string | null = null): Promise<string | null> {
  for (let i = 0; i < 150; i++) {
    const s = (await view(ctx, songId)).state;
    if ((s.kind === 'queued' || s.kind === 'running') && s.jobId && s.jobId !== notJob) return s.jobId;
    await sleep(100);
  }
  return null;
}

/** Follows one analysis job to its end and reads what it saved. */
export async function watchAnalysis(ctx: Ctx, a: Pick<AnalysisRecord, 'song' | 'title' | 'source' | 'trigger' | 'jobId'>): Promise<AnalysisRecord> {
  const seen = now();
  const progress: Progress[] = [];
  const f = await follow(ctx, a.jobId, ctx.readTimeoutMs, (j) => { if (j.progressText) progress.push({ t: now(), text: String(j.progressText) }); });
  const start = f.runningAt ?? seen;
  const v = await view(ctx, a.song);
  const raw = v.versionId ? stored(ctx, v.versionId) : null;
  const during = ctx.gpu.filter((g) => g.t >= start && g.t <= f.endAt).map((g) => g.mib);
  await sleep(1500);
  const r: AnalysisRecord = {
    ...a, versionId: v.versionId, number: v.number, audioS: songSeconds(ctx, a.song), status: String(f.last?.status ?? 'gone'),
    error: f.last?.error ? String(f.last.error) : null, queuedMs: start - seen, runMs: f.endAt - start, steps: analysisSteps(progress, f.endAt),
    plan: raw ? JSON.parse(raw).plan ?? null : null, notRead: v.shown?.notRead ?? null,
    sections: (v.shown?.sections ?? []).map((s) => ({ label: s.label, occurrence: s.occurrence, bars: s.bars, seconds: s.seconds })),
    mibPeak: during.length ? Math.max(...during) : null, mibEnd: gpuAfter(ctx.gpu, f.endAt + 1000)?.mib ?? null, endAt: f.endAt,
  };
  ctx.log(`  analysis ${a.trigger} ${a.title} v${r.number}: ${r.status} ${r.error ?? ''} run ${((r.runMs ?? 0) / 1000).toFixed(1)} s (waited ${((r.queuedMs ?? 0) / 1000).toFixed(1)} s) steps ${JSON.stringify(r.steps)} plan ${JSON.stringify(r.plan)} sections ${r.sections.map((s) => s.label).join(' ')} VRAM peak ${r.mibPeak} end ${r.mibEnd}`);
  return r;
}

export interface Sent { t0: number; status: number; jobId: string | null; messageId: string | null; reason: string | null; mark: (MarkSent & { kind: string; versionId: string }) | null }
export async function sendTurn(ctx: Ctx, threadId: string, text: string, mark: Sent['mark'] = null): Promise<Sent> {
  const t0 = now();
  const r = await json('POST', `${ctx.server}/api/chat/threads/${threadId}/turns`, { text, clientKey: `cp1-${t0}`, ...(mark ? { mark } : {}) });
  return { t0, status: r.status, jobId: r.body?.jobId ?? null, messageId: r.body?.messageId ?? null, reason: r.status === 202 ? null : JSON.stringify(r.body), mark };
}

const replyAfter = (msgs: Msg[], id: string | null) => msgs.slice(msgs.findIndex((m) => m.id === id) + 1).find((m) => m.role === 'assistant' && m.kind !== 'song' && m.kind !== 'version') ?? null;

/** The sent turn followed to its reply: wait, run time, ops (and the outside judge on a marked one), planner. */
export async function finishTurn(ctx: Ctx, threadId: string, s: Sent, meta: Pick<TurnRecord, 'song' | 'id' | 'role' | 'afterAnalysis' | 'text'>, starts: number[] | null): Promise<{ rec: TurnRecord; proposalId: string | null }> {
  const markBars = s.mark ? markBarsOf(s.mark, starts) : null;
  const rec: TurnRecord = {
    ...meta, mark: s.mark, markBars, postStatus: s.status, reason: s.reason, action: null, ops: [], outside: [], cardNotes: [],
    waitMs: null, runMs: null, totalMs: null, promptTokens: [], plannerOnGpu: null, plannerVram: null, vramBeforeMiB: null,
  };
  if (!s.jobId) return { rec, proposalId: null };
  const f = await follow(ctx, s.jobId, ctx.turnTimeoutMs);
  await sleep(300);
  const reply = replyAfter((await thread(ctx, threadId)).messages, s.messageId);
  const body = (reply?.body ?? {}) as { ops?: Array<Record<string, unknown>>; mark?: { bars: Bars | null; notes: string[] }; reasons?: string[]; cause?: string };
  const start = f.runningAt ?? s.t0;
  const win = plannerWindow(ctx.events, start, f.endAt);
  const gpu = plannerOnGpu(ctx.ps, start, f.endAt);
  Object.assign(rec, {
    action: reply?.kind ?? (f.timedOut ? 'timeout' : String(f.last?.status ?? 'gone')), ops: body.ops ?? [], cardNotes: body.mark?.notes ?? [],
    reason: body.reasons?.[0] ?? body.cause ?? (reply?.kind === 'say' || reply?.kind === 'ask' ? reply.text.slice(0, 200) : null),
    waitMs: start - s.t0, runMs: f.endAt - start, totalMs: f.endAt - s.t0, promptTokens: win.promptTokens,
    plannerOnGpu: gpu.on, plannerVram: gpu.vram, vramBeforeMiB: gpuAt(ctx.gpu, start)?.mib ?? null,
  });
  const judgeBars = body.mark?.bars ?? markBars;
  if (s.mark && reply?.kind === 'edit') rec.outside = judgeBars ? opsOutside(rec.ops, judgeBars, factsOf(ctx, meta.song)) : ['the mark has no bars to judge by'];
  ctx.log(`  turn ${meta.id}: ${rec.action} wait ${((rec.waitMs ?? 0) / 1000).toFixed(1)} s run ${((rec.runMs ?? 0) / 1000).toFixed(1)} s, tokens ${JSON.stringify(rec.promptTokens)}, ${rec.plannerVram ?? 'planner not seen'}, ops ${rec.ops.map((o) => `${o.op}${o.from_bar ? ` ${o.from_bar}-${o.to_bar}` : ''}${o.section ? ` S${o.section}` : ''}${o.block ? ` B${o.block}` : ''}`).join(', ')}${s.mark ? ` mark ${JSON.stringify(judgeBars)} outside ${JSON.stringify(rec.outside)}` : ''} ${rec.reason ?? ''}`);
  return { rec, proposalId: reply?.kind === 'edit' ? reply.proposalId : null };
}

export async function pressApply(ctx: Ctx, threadId: string, proposalId: string) {
  const press = now();
  const r = await json('POST', `${ctx.server}/api/chat/threads/${threadId}/apply`, { proposalId });
  return { press, status: r.status, jobId: (r.body?.jobId as string | undefined) ?? null, reason: r.status === 202 ? null : JSON.stringify(r.body) };
}

export async function followApply(ctx: Ctx, threadId: string, a: Awaited<ReturnType<typeof pressApply>>, tag: string) {
  if (!a.jobId) return { outcome: 'refused', waitMs: null, runningAt: null, editMs: null, versionId: null, reason: a.reason };
  let phase = '';
  const f = await follow(ctx, a.jobId, ctx.takeTimeoutMs, (j) => {
    const p = `${j.status} ${j.progressText ?? ''}`.trim();
    if (p !== phase) { phase = p; ctx.log(`  apply ${tag}: ${p} (+${((now() - a.press) / 1000).toFixed(1)} s)`); }
  });
  const card = (await thread(ctx, threadId)).messages.find((m) => m.kind === 'version' && m.jobId === a.jobId) as (Msg & { versionId?: string }) | undefined;
  return { outcome: f.timedOut ? 'timeout' : f.last?.status === 'done' ? 'saved' : 'failed', waitMs: f.runningAt === null ? null : f.runningAt - a.press, runningAt: f.runningAt, editMs: f.endAt - a.press, versionId: card?.versionId ?? null, reason: f.last?.error ? String(f.last.error) : null };
}

export type MarkKind = 'one' | 'cross' | 'secs';
/** A mark as the strip would send it (D-175): a section, a section's end into the next one, or a time only. */
export function buildMark(v: View, kind: MarkKind, pick: number): Sent['mark'] {
  const sh = v.shown;
  if (!sh?.bars || !v.versionId) return null;
  const { starts, end } = sh.bars;
  const sec = (b: Bars): Bars => [starts[b[0] - 1], b[1] < starts.length ? starts[b[1]] : end];
  const pool = sh.sections.filter((s) => s.bars[1] - s.bars[0] >= 3 && /verse|chorus|bridge|pre/i.test(s.label));
  const list = pool.length ? pool : sh.sections;
  const s = list[pick % list.length];
  if (kind === 'one') return { kind: 'range', versionId: v.versionId, bars: s.bars, seconds: sec(s.bars) };
  if (kind === 'secs') { const [a, b] = sec(s.bars); return { kind: 'range', versionId: v.versionId, seconds: [Number((a + 0.4).toFixed(2)), Number((b - 0.4).toFixed(2))] }; }
  const i = sh.sections.indexOf(s);
  const next = sh.sections[i + 1] ?? s; const prev = sh.sections[i + 1] ? s : sh.sections[i - 1] ?? s;
  const bars: Bars = [Math.max(prev.bars[0], prev.bars[1] - 1), Math.min(next.bars[1], next.bars[0] + 3)];
  return { kind: 'range', versionId: v.versionId, bars, seconds: sec(bars) };
}
