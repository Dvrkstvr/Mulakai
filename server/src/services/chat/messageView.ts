/**
 * What the client shows for a thread (F-041 #2, F-049 #3): each message row + its live job + the
 * proposal store -> a state, on the wire shape `client/src/api/chat.ts` reads (draft fields filled
 * with null / [], a recipe card's recipe camel-cased like the draft, bodies with `chat_v`). A user
 * message is queued / thinking while its turn job lives, then done / failed / cancelled from the reply
 * after it, or interrupted when the job vanished with no reply (a restart). A recipe card is pending,
 * superseded, expired (the server forgot it), committing (its CREATE SONG job runs) or done (a song
 * card from that job follows); an edit card likewise, with APPLY and a version card (C0b), and interrupted when a
 * restart cut its APPLY (the job vanished with nothing saved): while it commits, `phase`
 * names the step (queued, rendering, splicing, saving); APPLY refused because the song changed reads stale; a
 * version card drops its A/B once the version before it is gone. C2: a recipe offers UNDO TURN (`undo`, F-059). Pure.
 */
import { recipeFields } from './draftModel.js';
import type { ChatMessage, Draft, DraftFields, EditBody, FailedBody, MessageState, ReadingBody, RecipeBody } from './chatTypes.js';
import { withPrevious, type VersionCardBody } from './versionCard.js';

export interface JobView { status: 'queued' | 'loading' | 'running' | 'done' | 'failed'; error?: string; progressText?: string; queuePosition?: number; cancelled?: boolean }
export interface ViewContext {
  job: (jobId: string) => JobView | undefined;
  proposal: (proposalId: string) => 'live' | 'superseded' | null;
  /** C0b: whether a version still exists (a version card's A/B); absent = assume it does. */
  versionExists?: (versionId: string) => boolean;
  /** C2: the thread has a song (UNDO TURN is not offered); absent = no song. */
  hasSong?: boolean;
}

/** An edit card's APPLY phase while it commits (the thread line, F-049 #3): its job's `progressText`. */
export type CommitPhase = 'queued' | 'rendering' | 'splicing' | 'saving';
const PHASES = new Set<string>(['rendering', 'splicing', 'saving']);

const live = (j: JobView | undefined) => Boolean(j && (j.status === 'queued' || j.status === 'loading' || j.status === 'running'));

/** The draft's fields with every key present: null or [] when not filled (the client's shape). */
export function wireFields(f: DraftFields) {
  return {
    title: f.title ?? null, style: f.style ?? null, bpm: f.bpm ?? null, key: f.key ?? null, timeSignature: f.timeSignature ?? null,
    language: f.language ?? null, structure: f.structure ?? [], lyrics: f.lyrics ?? [], engine: f.engine ?? 'yue2',
  };
}
export const wireDraft = (d: Draft) => ({ ...d, fields: wireFields(d.fields) });

const QUARTERS: Record<string, number> = { '2/4': 2, '3/4': 3, '4/4': 4, '6/8': 3 };
/** About how long YuE2's take of these fields runs (inferred: 2 bars per sung line, 8 bars per
 * section with no lines), for the card's "about N min"; null without a structure. Capped at 360 s. */
export function estSeconds(f: DraftFields): number | null {
  if (!f.structure?.length) return null;
  const lyrics = [...(f.lyrics ?? [])];
  const bars = f.structure.reduce((n, tag) => {
    const i = lyrics.findIndex((s) => s.tag === tag);
    const lines = i < 0 ? 0 : lyrics.splice(i, 1)[0].lines.length;
    return n + (lines ? lines * 2 : 8);
  }, 0);
  const seconds = (bars * (QUARTERS[f.timeSignature ?? ''] ?? 4) * 60) / (f.bpm && f.bpm > 0 ? f.bpm : 100);
  return Math.min(360, Math.round(seconds));
}

function wireBody(m: ChatMessage, ctx: ViewContext): Record<string, unknown> | null {
  if (!m.body) return null;
  if (m.kind === 'version' && ctx.versionExists && 'previous' in m.body) return { chat_v: 1, ...withPrevious(m.body as VersionCardBody, ctx.versionExists) };
  if (m.kind !== 'recipe') return { chat_v: 1, ...m.body };
  const b = m.body as RecipeBody;
  const fields = recipeFields(b.recipe);
  return { chat_v: 1, ...b, recipe: wireFields(fields), estSeconds: estSeconds(fields) };
}

/** The turn's reply: the first assistant message after the user's that is not a commit's card. */
function replyOf(messages: ChatMessage[], i: number): ChatMessage | null {
  for (const m of messages.slice(i + 1)) {
    if (m.role === 'user') return null;
    if (m.kind !== 'song' && m.kind !== 'version') return m;
  }
  return null;
}

const failedState = (m: ChatMessage): MessageState => ((m.body as FailedBody | null)?.cause === 'cancelled' ? 'cancelled' : 'failed');

function userState(messages: ChatMessage[], i: number, ctx: ViewContext): MessageState | null {
  const m = messages[i];
  const reply = replyOf(messages, i);
  if (reply) return reply.kind === 'failed' ? failedState(reply) : 'done';
  const job = m.jobId ? ctx.job(m.jobId) : undefined;
  if (job?.status === 'queued') return 'queued';
  if (live(job)) return 'thinking';
  if (job?.cancelled) return 'cancelled';
  return job?.status === 'failed' ? 'failed' : 'interrupted';
}

/** A recipe card (its commit makes a song card) or, C0b, an edit card (its APPLY makes a version card). */
function cardState(messages: ChatMessage[], m: ChatMessage, ctx: ViewContext, made: 'song' | 'version'): MessageState {
  if (m.jobId && messages.some((s) => s.kind === made && s.jobId === m.jobId)) return 'done';
  const life = m.proposalId ? ctx.proposal(m.proposalId) : null;
  // An edit card keeps its job id only while its APPLY runs or after it saved (editCommit clears it when the APPLY
  // ends with nothing saved); a job id the server no longer knows means a restart cut the APPLY (F-049 #3).
  if (!life) return m.kind === 'edit' && m.jobId && !ctx.job(m.jobId) ? 'interrupted' : 'expired';
  if (life === 'superseded') return 'superseded';
  if (m.jobId && live(ctx.job(m.jobId))) return 'committing';
  return m.kind === 'edit' && (m.body as EditBody | null)?.stale ? 'stale' : 'pending';
}

function commitPhase(m: ChatMessage, state: MessageState | null, job: JobView | null): CommitPhase | null {
  if (m.kind !== 'edit' || state !== 'committing' || !job) return null;
  if (job.status === 'queued' || job.status === 'loading') return 'queued';
  return job.progressText && PHASES.has(job.progressText) ? (job.progressText as CommitPhase) : null;
}

/** The reading card of an analyze card's READ whose reading ended with nothing saved (failed, cancelled, lost):
 * READ is open again on the analyze card (C3 review 3). A saved reading hands the card's job id to the follow-up
 * turn, so a matching card with no reading is one that never read. */
export function unreadCard(analyze: ChatMessage, messages: ChatMessage[], job: JobView | undefined): ChatMessage | null {
  if (!analyze.jobId || live(job)) return null;
  const card = messages.find((c) => c.kind === 'reading' && c.jobId === analyze.jobId);
  return card && !(card.body as ReadingBody | null)?.reading ? card : null;
}

function analyzeState(m: ChatMessage, messages: ChatMessage[], ctx: ViewContext): MessageState {
  if (m.jobId && !unreadCard(m, messages, ctx.job(m.jobId))) return live(ctx.job(m.jobId)) ? 'committing' : 'done';
  const life = m.proposalId ? ctx.proposal(m.proposalId) : null;
  return life === 'live' ? 'pending' : life ?? 'expired';
}

function readingState(m: ChatMessage, ctx: ViewContext): MessageState {
  const job = m.jobId ? ctx.job(m.jobId) : undefined;
  if (job?.status === 'queued') return 'queued';
  const saved = Boolean((m.body as ReadingBody | null)?.reading);
  if (live(job)) return saved ? 'thinking' : 'reading';
  if (saved || job?.status === 'done') return 'done';
  if (job?.cancelled) return 'cancelled';
  return job ? 'failed' : 'interrupted';
}

/** UNDO TURN (F-059, D-220): offered on a recipe whose turn filled a field, until undone or once a song exists. */
function undoOffer(m: ChatMessage, state: MessageState | null, ctx: ViewContext): 'offer' | 'done' | null {
  const b = m.kind === 'recipe' ? (m.body as RecipeBody | null) : null;
  if (!b?.undo?.fields?.length) return null;
  if (b.undone) return 'done';
  return ctx.hasSong || state === 'done' ? null : 'offer';
}

export function messageViews(messages: ChatMessage[], ctx: ViewContext) {
  return messages.map((m, i) => {
    let state: MessageState | null = null;
    if (m.role === 'user') state = userState(messages, i, ctx);
    else if (m.kind === 'failed') state = failedState(m);
    else if (m.kind === 'recipe') state = cardState(messages, m, ctx, 'song');
    else if (m.kind === 'edit') state = cardState(messages, m, ctx, 'version');
    else if (m.kind === 'analyze') state = analyzeState(m, messages, ctx);
    else if (m.kind === 'reading') state = readingState(m, ctx);
    const job = m.jobId ? ctx.job(m.jobId) ?? null : null;
    return { ...m, body: wireBody(m, ctx), state, job, phase: commitPhase(m, state, job), undo: undoOffer(m, state, ctx) };
  });
}
