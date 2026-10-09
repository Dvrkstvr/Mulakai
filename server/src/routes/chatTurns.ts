/**
 * A chat turn and CREATE SONG (F-042, F-044, F-049): SEND (idempotent on `clientKey`: a replayed key
 * answers the first message's job, 200), CANCEL a turn or a take, and CREATE SONG from a recipe card
 * (409 `{reason}` when the re-check refuses). Job progress is the existing GET /api/generate/:jobId.
 * C3: SEND may carry `attach: {referenceId}` (one of the draft thread's references, D-130); a reading
 * that will queue the follow-up turn keeps SEND off like an open turn (D-129); CANCEL stops a reading too.
 * C0b: APPLY on an edit card (editCommit); CANCEL stops it (rendering: the existing ABORT; splicing: the job ends
 * the yue splice); a SEND during it queues behind it, so the turn reads the new version.
 * C1: SEND may carry `mark` (a `range` referent, D-175): pinned → frozen in the user message (the echo); stale →
 * 409 `{error: 'MARK_STALE', reason, was, shift}`, nothing written; past the song's end → 400.
 * C4 (D-268): RE-RENDER WHOLE SONG on the active spliced version's card appends a whole-song edit card (rerenderWhole).
 */
import { Router } from 'express';
import { config } from '../config.js';
import { db } from '../db/index.js';
import { QueueFullError, queuePosition } from '../services/genQueue.js';
import { abortJob, getJob } from '../services/jobRegistry.js';
import { createDeps, createFromDraft, type CreateDeps } from '../services/chat/createFromDraft.js';
import { applyEdit, applyEnded, editCommitDeps, type EditCommitDeps } from '../services/chat/editCommit.js';
import { appendMessage, listMessages, updateMessage } from '../services/chat/messageStore.js';
import { cancelReading, readingOf } from '../services/chat/readingJob.js';
import { getReference } from '../services/chat/referenceStore.js';
import { threadById } from '../services/chat/threadStore.js';
import { rerenderDeps, rerenderWhole, type RerenderDeps } from '../services/chat/rerenderWhole.js';
import { cancelTurn, startChatTurn, turnDeps, turnOf, type TurnDeps } from '../services/chat/turnJob.js';
import type { ChatMessage, ReadingBody } from '../services/chat/chatTypes.js';
import { MARK_STALE, parseRange } from '../services/score/planReferent.js';
import { markAt } from '../services/chat/songStateSource.js';
import type { RangeMark, RangeResolution } from '../services/chat/analysisTypes.js';

export const TEXT_MAX = 4000;
export const TURN_OPEN = 'the assistant is still answering in this chat: wait for it or CANCEL';
export const NO_ASSISTANT = 'the assistant is not set up: set LLM_API_URL on the server';
export const ATTACH_ON_SONG = 'a reference starts a new song: press NEW CHAT and attach it there';
export const MARK_ON_DRAFT = 'a mark needs a song: there is nothing to mark on a new-song chat';
/** The stale-mark refusal the client reads (CL-7): `was` the mark as sent, `shift` for USE BARS or null. */
export const markStaleBody = (s: Extract<RangeResolution, { pinned: false }>) => ({ error: MARK_STALE, reason: s.reason, was: s.was, shift: s.shift });

export interface TurnRouteDeps {
  turn: () => TurnDeps;
  create: () => CreateDeps;
  llmConfigured: () => boolean;
  /** C0b: APPLY on an edit card. */
  apply?: () => EditCommitDeps;
  /** C4: RE-RENDER WHOLE SONG. */
  rerender?: () => RerenderDeps;
}
const defaults: TurnRouteDeps = {
  turn: () => turnDeps(), create: () => createDeps(), llmConfigured: () => Boolean(config.llmUrl), apply: () => editCommitDeps(), rerender: () => rerenderDeps(),
};

const live = (jobId: string | null) => ['queued', 'loading', 'running'].includes(jobId ? getJob(jobId)?.status ?? '' : '');
/** A turn is open until its body has settled: a cancelled one still unloads, then writes its reply. */
const turnOpen = (jobId: string | null) => live(jobId) || Boolean(jobId && turnOf(jobId));
/** A user turn, or a reading that queues the follow-up turn when it saves (its job id moves to that turn). */
const holdsSend = (m: ChatMessage) => (m.role === 'user' || (m.kind === 'reading' && (m.body as ReadingBody | null)?.followUp === true)) && turnOpen(m.jobId);

export function makeChatTurnsRouter(deps: TurnRouteDeps = defaults): Router {
  const router = Router();

  router.post('/threads/:id/turns', (req, res) => {
    const { text, clientKey, attach, mark } = (req.body ?? {}) as { text?: unknown; clientKey?: unknown; attach?: { referenceId?: unknown }; mark?: unknown };
    if (typeof text !== 'string' || !text.trim() || text.length > TEXT_MAX) return res.status(400).json({ error: `send text of 1-${TEXT_MAX} characters` });
    const parsedMark = parseRange(mark);
    if (!parsedMark.ok) return res.status(400).json({ error: parsedMark.error });
    const refId = attach === undefined || attach === null ? null : typeof attach === 'object' && typeof attach.referenceId === 'string' ? attach.referenceId : undefined;
    if (refId === undefined) return res.status(400).json({ error: 'attach must be {referenceId}' });
    const key = typeof clientKey === 'string' && clientKey ? clientKey.slice(0, 100) : null;
    const thread = threadById(req.params.id);
    if (!thread) return res.status(404).json({ error: 'unknown chat' });
    const messages = listMessages(thread.id);
    const first = key ? messages.find((m) => m.role === 'user' && m.clientKey === key) : undefined;
    if (first) return res.json({ jobId: first.jobId, messageId: first.id, position: (first.jobId && queuePosition(first.jobId)) || 0 });
    if (refId && getReference(refId)?.threadId !== thread.id) return res.status(400).json({ error: 'that reference is not attached to this chat' });
    if (refId && thread.songId) return res.status(409).json({ error: ATTACH_ON_SONG, reason: ATTACH_ON_SONG });
    if (!deps.llmConfigured()) return res.status(409).json({ error: NO_ASSISTANT, reason: NO_ASSISTANT });
    if (messages.some(holdsSend)) return res.status(409).json({ error: TURN_OPEN, reason: TURN_OPEN });
    let pinned: RangeMark | null = null;
    if (parsedMark.mark) {
      // C1 (D-175): resolved now against the playable version; stale → 409 MARK_STALE and nothing written.
      if (!thread.songId) return res.status(400).json({ error: MARK_ON_DRAFT });
      const at = markAt(thread.songId, parsedMark.mark);
      if (!at.ok) return res.status(409).json(markStaleBody(at.stale));
      if (at.outside) return res.status(400).json({ error: at.outside });
      pinned = at.mark;
    }
    try {
      // One transaction: a refused queue leaves no message behind, so the resend with the same key is one turn.
      const started = db.transaction(() => {
        const { message } = appendMessage(thread.id, { role: 'user', kind: 'text', text: text.trim(), body: { sentRev: thread.draft.rev, ...(refId ? { attach: { referenceId: refId } } : {}), ...(pinned ? { mark: pinned } : {}) }, clientKey: key });
        const job = startChatTurn(thread.id, message, thread.songId, deps.turn());
        updateMessage(message.id, { jobId: job.id });
        return { job, message };
      })();
      res.status(202).json({ jobId: started.job.id, messageId: started.message.id, position: queuePosition(started.job.id) ?? 0 });
    } catch (err) {
      if (err instanceof QueueFullError) return res.status(409).json({ error: err.message, reason: err.message });
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  /** CANCEL a chat job: a turn (queued: out of the line; thinking: abort, then the unload), a reading (it stops at
   * its next step and reads CANCELLED, not failed) or a take (the existing abort). */
  router.post('/jobs/:jobId/cancel', (req, res) => {
    const { jobId } = req.params;
    const turn = cancelTurn(jobId);
    if (turn) return res.json({ ok: true, ...turn });
    const queued = getJob(jobId)?.status === 'queued';
    if (readingOf(jobId) && cancelReading(jobId)) {
      const job = getJob(jobId);
      if (job) job.cancelled = true;
      return res.json({ ok: true, ...(queued ? { cancelled: true } : { aborted: true }) });
    }
    const kinds = (db.prepare(`SELECT kind FROM chat_messages WHERE job_id = ?`).all(jobId) as Array<{ kind: string }>).map((m) => m.kind);
    if (kinds.length && live(jobId) && abortJob(jobId)) {
      // An APPLY reads CANCELLED like a turn or a reading (nothing saved); a save already under way clears it again.
      const job = getJob(jobId);
      if (job && kinds.includes('edit')) job.cancelled = true;
      if (queued && kinds.includes('edit')) applyEnded(jobId); // its body never runs, so it cannot clear the card
      return res.json({ ok: true, ...(queued ? { cancelled: true } : { aborted: true }) });
    }
    res.status(404).json({ error: 'this job is not running' });
  });

  router.post('/threads/:id/create', async (req, res) => {
    const { proposalId } = (req.body ?? {}) as { proposalId?: unknown };
    if (typeof proposalId !== 'string' || !proposalId) return res.status(400).json({ error: 'send {proposalId}' });
    if (!threadById(req.params.id)) return res.status(404).json({ error: 'unknown chat' });
    try {
      const out = await createFromDraft(req.params.id, proposalId, deps.create());
      if ('reason' in out) return res.status(409).json({ reason: out.reason });
      res.status(202).json({ jobId: out.job.id });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  /** APPLY (C0b, F-047, F-049): 202 `{jobId}`, or 409 `{reason, stale}` when the re-check refuses (stale: the song
   * changed since the plan, the card reads STALE and offers ASK AGAIN). CANCEL is the chat job cancel above. */
  router.post('/threads/:id/apply', async (req, res) => {
    const { proposalId } = (req.body ?? {}) as { proposalId?: unknown };
    if (typeof proposalId !== 'string' || !proposalId) return res.status(400).json({ error: 'send {proposalId}' });
    if (!threadById(req.params.id)) return res.status(404).json({ error: 'unknown chat' });
    try {
      const out = await applyEdit(req.params.id, proposalId, (deps.apply ?? defaults.apply!)());
      if ('reason' in out) return res.status(409).json({ reason: out.reason, stale: out.stale === true });
      res.status(202).json({ jobId: out.job.id });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  /** RE-RENDER WHOLE SONG (F-066 #5, D-268): 201 `{messageId, proposalId}`, the pending edit card it appended; 409
   * `{reason}` (a turn or an APPLY runs, not the active version, not spliced, over a limit); 404 no such card here. */
  router.post('/threads/:id/versions/:versionId/rerender', async (req, res) => {
    const thread = threadById(req.params.id);
    if (!thread) return res.status(404).json({ error: 'unknown chat' });
    if (listMessages(thread.id).some(holdsSend)) return res.status(409).json({ error: TURN_OPEN, reason: TURN_OPEN });
    try {
      const out = await rerenderWhole(thread.id, req.params.versionId, (deps.rerender ?? defaults.rerender!)());
      if ('reason' in out) return res.status(out.missing ? 404 : 409).json({ error: out.reason, reason: out.reason });
      res.status(201).json(out);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  return router;
}

export const chatTurnsRouter = makeChatTurnsRouter();
