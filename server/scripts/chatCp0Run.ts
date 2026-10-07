/**
 * CP-C0a-ONLY HTTP steps for chatCp0.ts (not app code, never imported by src/): one describe turn on a
 * fresh draft thread (NEW CHAT, SEND, follow the job, read the reply), and CREATE SONG on a recipe card
 * (press, follow the take until saved). Everything goes through the server's own chat routes and
 * `GET /api/generate/:jobId`; planner timings come from scoreCp1Lib's proxy log, VRAM from its sampler.
 */
import { gpuAfter, gpuAt, json, now, sleep, type GpuSample, type ProxyEvent } from './scoreCp1Lib.js';
import { plannerWindow, type CreateResult, type TurnResult } from './chatCp0Stats.js';

export interface Prompt { id: string; lang: string; expect: TurnResult['expect']; text: string }
export interface RunCtx { server: string; proxied: boolean; events: ProxyEvent[]; gpu: GpuSample[]; log: (m: string) => void; turnTimeoutMs: number; takeTimeoutMs: number }
export interface Msg { id: string; role: string; kind: string; text: string; body: Record<string, unknown> | null; proposalId: string | null; jobId: string | null }
export interface Thread { id: string; songId: string | null; messages: Msg[] }

const LIVE = ['queued', 'loading', 'running'];
export const attemptOf = (progressText: unknown) => Number(/attempt (\d+) of/.exec(String(progressText ?? ''))?.[1]) || null;

/** Polls the job until it leaves queued / loading / running (a 404 = the registry forgot it). */
export async function follow(ctx: RunCtx, jobId: string, timeoutMs: number, onPoll: (j: Record<string, unknown>) => void = () => {}) {
  const t0 = now();
  let runningAt: number | null = null;
  let last: Record<string, unknown> | null = null;
  for (;;) {
    const r = await json('GET', `${ctx.server}/api/generate/${jobId}`);
    last = r.status === 200 ? r.body : null;
    if (!last) break;
    onPoll(last);
    if (runningAt === null && last.status !== 'queued') runningAt = now();
    if (!LIVE.includes(String(last.status))) break;
    if (now() - t0 > timeoutMs) return { last, runningAt, endAt: now(), timedOut: true };
    await sleep(100);
  }
  return { last, runningAt, endAt: now(), timedOut: false };
}

export const thread = async (ctx: RunCtx, id: string) => (await json('GET', `${ctx.server}/api/chat/threads/${id}`)).body as Thread;

export async function runTurn(ctx: RunCtx, p: Prompt, index: number): Promise<{ result: TurnResult; threadId: string; proposalId: string | null }> {
  const reset = await json('POST', `${ctx.server}/api/chat/draft/reset`);
  if (reset.status !== 200) throw new Error(`NEW CHAT refused ${reset.status}: ${JSON.stringify(reset.body)}`);
  const threadId = (reset.body as Thread).id;
  const { result, reply } = await turnOn(ctx, threadId, { index, id: p.id, lang: p.lang, expect: p.expect }, p.text);
  return { result, threadId, proposalId: reply?.kind === 'recipe' ? reply.proposalId : null };
}

/** One SEND on an existing thread, followed to its reply: turn time, attempts and the proxy's planner window. */
export async function turnOn(ctx: RunCtx, threadId: string, who: Pick<TurnResult, 'index' | 'id' | 'lang' | 'expect'>, text: string): Promise<{ result: TurnResult; reply: Msg | null }> {
  const base: TurnResult = {
    ...who, prompt: text, postStatus: 0, action: null, cause: null, reasons: [],
    attempts: null, calls: null, turnMs: null, queuedMs: null, promptTokens: [], unloadMs: null, vram: null,
  };
  const t0 = now();
  const post = await json('POST', `${ctx.server}/api/chat/threads/${threadId}/turns`, { text, clientKey: `cp0-${who.id}-${who.index}-${t0}` });
  base.postStatus = post.status;
  if (post.status !== 202) return { result: { ...base, reasons: [JSON.stringify(post.body)] }, reply: null };
  const { jobId, messageId } = post.body as { jobId: string; messageId: string };
  let attempts = 0;
  const f = await follow(ctx, jobId, ctx.turnTimeoutMs, (j) => { attempts = Math.max(attempts, attemptOf(j.progressText) ?? 0); });
  const t1 = f.endAt;
  await sleep(250); // the proxy records an event after it answered
  const msgs = (await thread(ctx, threadId)).messages;
  const at = msgs.findIndex((m) => m.id === messageId);
  const reply = msgs.slice(at + 1).find((m) => m.role !== 'user' && m.kind !== 'song' && m.kind !== 'version') ?? null;
  const win = plannerWindow(ctx.events, t0, t1);
  const emptyAt = win.unloadMs === null ? null : t1; // the job settles only after /api/ps showed empty (turnJob.ts)
  const during = ctx.gpu.filter((g) => g.t >= t0 && g.t <= t1).map((g) => g.mib);
  const body = (reply?.body ?? {}) as { cause?: string; reasons?: string[] };
  const result: TurnResult = {
    ...base, action: reply?.kind ?? (f.timedOut ? 'timeout' : null), cause: body.cause ?? null,
    reasons: body.reasons ?? (f.last?.error ? [String(f.last.error)] : []),
    attempts: attempts || null, calls: ctx.proxied ? win.calls : null, turnMs: t1 - t0,
    queuedMs: f.runningAt === null ? null : f.runningAt - t0, promptTokens: win.promptTokens, unloadMs: win.unloadMs,
    vram: ctx.gpu.length ? { beforeMiB: gpuAt(ctx.gpu, t0)?.mib ?? null, peakMiB: during.length ? Math.max(...during) : null, atEmptyMiB: emptyAt ? gpuAfter(ctx.gpu, emptyAt)?.mib ?? null : null } : null,
  };
  return { result, reply };
}

/** CREATE SONG on the recipe card, then the take until saved: hand-off = press -> the take's job running. */
export async function runCreate(ctx: RunCtx, threadId: string, proposalId: string): Promise<CreateResult> {
  const press = now();
  const post = await json('POST', `${ctx.server}/api/chat/threads/${threadId}/create`, { proposalId });
  const ps = ctx.events.find((e) => e.path.startsWith('/api/ps') && e.t0 >= press);
  const plannerLoadedAtPress = ps ? (ps.info.models as unknown[]).length > 0 : null;
  if (post.status !== 202) {
    return { postStatus: post.status, outcome: 'refused', reason: JSON.stringify(post.body), handoffMs: null, takeMs: null, songId: null, seconds: null, plannerLoadedAtPress };
  }
  const jobId = (post.body as { jobId: string }).jobId;
  let stage = '';
  const f = await follow(ctx, jobId, ctx.takeTimeoutMs, (j) => {
    const s = `${j.status} ${j.progressStage ?? ''} ${j.progressText ?? ''}`.trim();
    if (s !== stage) { stage = s; ctx.log(`  take ${jobId.slice(0, 8)}: ${s}`); }
  });
  const takeMs = f.endAt - press;
  const out: CreateResult = {
    postStatus: post.status, jobId, outcome: f.timedOut ? 'timeout' : f.last?.status === 'done' ? 'saved' : 'failed',
    reason: f.last?.error ? String(f.last.error) : undefined, handoffMs: f.runningAt === null ? null : f.runningAt - press, takeMs,
    songId: null, seconds: null, plannerLoadedAtPress,
  };
  for (let i = 0; out.outcome === 'saved' && i < 50; i++) { // the song card lands right after the save
    const t = await thread(ctx, threadId);
    const card = t.messages.find((m) => m.kind === 'song' && m.jobId === jobId);
    if (card) return { ...out, songId: t.songId, seconds: (card.body?.seconds as number | null) ?? null };
    await sleep(100);
  }
  return out;
}
