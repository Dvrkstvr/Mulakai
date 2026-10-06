/**
 * A chat turn and CREATE SONG (F-042, F-044, F-049): SEND (idempotent on `clientKey`: a replayed key
 * answers the first message's job, 200), CANCEL a turn or a take, and CREATE SONG from a recipe card
 * (409 `{reason}` when the re-check refuses). Job progress is the existing GET /api/generate/:jobId.
 * C3: SEND may carry `attach: {referenceId}` (one of the draft thread's references, D-130); a reading
 * that will queue the follow-up turn keeps SEND off like an open turn (D-129).
 */
import { Router } from 'express';
import { config } from '../config.js';
import { db } from '../db/index.js';
import { QueueFullError, queuePosition } from '../services/genQueue.js';
import { abortJob, getJob } from '../services/jobRegistry.js';
import { createDeps, createFromDraft, type CreateDeps } from '../services/chat/createFromDraft.js';
import { appendMessage, listMessages, updateMessage } from '../services/chat/messageStore.js';
import { getReference } from '../services/chat/referenceStore.js';
import { threadById } from '../services/chat/threadStore.js';
import { cancelTurn, startChatTurn, turnDeps, turnOf, type TurnDeps } from '../services/chat/turnJob.js';
import type { ChatMessage, ReadingBody } from '../services/chat/chatTypes.js';

export const TEXT_MAX = 4000;
export const TURN_OPEN = 'the assistant is still answering in this chat: wait for it or CANCEL';
export const NO_ASSISTANT = 'the assistant is not set up: set LLM_API_URL on the server';
export const ATTACH_ON_SONG = 'a reference starts a new song: press NEW CHAT and attach it there';

export interface TurnRouteDeps {
  turn: () => TurnDeps;
  create: () => CreateDeps;
  llmConfigured: () => boolean;
}
const defaults: TurnRouteDeps = { turn: () => turnDeps(), create: () => createDeps(), llmConfigured: () => Boolean(config.llmUrl) };

const live = (jobId: string | null) => ['queued', 'loading', 'running'].includes(jobId ? getJob(jobId)?.status ?? '' : '');
/** A turn is open until its body has settled: a cancelled one still unloads, then writes its reply. */
const turnOpen = (jobId: string | null) => live(jobId) || Boolean(jobId && turnOf(jobId));
/** A user turn, or a reading that queues the follow-up turn when it saves (its job id moves to that turn). */
const holdsSend = (m: ChatMessage) => (m.role === 'user' || (m.kind === 'reading' && (m.body as ReadingBody | null)?.followUp === true)) && turnOpen(m.jobId);

export function makeChatTurnsRouter(deps: TurnRouteDeps = defaults): Router {
  const router = Router();

  router.post('/threads/:id/turns', (req, res) => {
    const { text, clientKey, attach } = (req.body ?? {}) as { text?: unknown; clientKey?: unknown; attach?: { referenceId?: unknown } };
    if (typeof text !== 'string' || !text.trim() || text.length > TEXT_MAX) return res.status(400).json({ error: `send text of 1-${TEXT_MAX} characters` });
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
    try {
      // One transaction: a refused queue leaves no message behind, so the resend with the same key is one turn.
      const started = db.transaction(() => {
        const { message } = appendMessage(thread.id, { role: 'user', kind: 'text', text: text.trim(), body: { sentRev: thread.draft.rev, ...(refId ? { attach: { referenceId: refId } } : {}) }, clientKey: key });
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

  /** CANCEL a chat job: a turn (queued: out of the line; thinking: abort, then the unload) or a take (the existing abort). */
  router.post('/jobs/:jobId/cancel', (req, res) => {
    const { jobId } = req.params;
    const turn = cancelTurn(jobId);
    if (turn) return res.json({ ok: true, ...turn });
    const isChatJob = db.prepare(`SELECT 1 FROM chat_messages WHERE job_id = ?`).get(jobId);
    if (isChatJob && live(jobId)) {
      const queued = getJob(jobId)?.status === 'queued';
      if (abortJob(jobId)) return res.json({ ok: true, ...(queued ? { cancelled: true } : { aborted: true }) });
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

  return router;
}

export const chatTurnsRouter = makeChatTurnsRouter();
