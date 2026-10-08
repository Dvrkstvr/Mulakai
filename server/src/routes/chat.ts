/**
 * The chat's threads and draft (F-041, F-043; architecture.md "Chat (C0)", wire shapes in
 * client/src/api/chat.ts): status, the draft thread, NEW CHAT, a thread, a song's thread, and the
 * sidebar's hand edits with a rev check (a stale rev is 409 `{ok: false, current}`). C3: the view
 * lists the thread's references; NEW CHAT's dropped references lose their files (sweepFiles); a cover
 * draft's blockers add coverBlockers; a hand edit names the locked cover fields it refused (D-148 c).
 * C2: UNDO TURN on a recipe reply (F-059, D-220): draft and the body's `undone` in one transaction.
 */
import { Router } from 'express';
import { db } from '../db/index.js';
import { yue2Engine } from '../services/engines/yue2.js';
import { queuePosition } from '../services/genQueue.js';
import { getJob } from '../services/jobRegistry.js';
import { chatStatus, type ChatStatus } from '../services/chat/chatStatus.js';
import { ensureAnalysis } from '../services/chat/analysisTrigger.js';
import { takeRunning } from '../services/chat/createFromDraft.js';
import { handEdit } from '../services/chat/draftModel.js';
import { draftUndo, undoneRecord } from '../services/chat/draftUndo.js';
import { listMessages, messageById, updateMessage } from '../services/chat/messageStore.js';
import { messageViews, wireDraft, type JobView } from '../services/chat/messageView.js';
import { dropProposals, proposalLife } from '../services/chat/proposalStore.js';
import { createBlockers } from '../services/chat/recipeRules.js';
import { coverBlockers } from '../services/chat/referenceRecipe.js';
import { getReference, listReferences, sweepFiles } from '../services/chat/referenceStore.js';
import { referenceView } from '../services/chat/readTarget.js';
import { draftThread, resetDraftThread, songThread, threadById, writeDraft } from '../services/chat/threadStore.js';
import type { ChatThread, RecipeBody } from '../services/chat/chatTypes.js';
import type { UndoResult } from '../services/chat/convergeTypes.js';

export interface ChatRouteDeps {
  status: () => Promise<ChatStatus>;
  yueConfigured: () => boolean;
  /** C1 (D-172): a song's thread GET queues its take's analysis if it has none; absent = none (route tests). */
  ensureAnalysis?: (songId: string) => unknown;
}
const defaults: ChatRouteDeps = { status: () => chatStatus(), yueConfigured: () => Boolean(yue2Engine.url), ensureAnalysis };

export function jobView(jobId: string): JobView | undefined {
  const job = getJob(jobId);
  if (!job) return undefined;
  const { status, error, progressText, cancelled } = job;
  return { status, error, progressText, cancelled, ...(status === 'queued' ? { queuePosition: queuePosition(jobId) } : {}) };
}
/** A version card's A/B needs the version before it (F-048 edge: deleted in the Editor → no A/B). */
const versionExists = (versionId: string): boolean => Boolean(db.prepare(`SELECT 1 FROM versions WHERE id = ?`).get(versionId));
const isLive = (jobId: string | null) => ['queued', 'loading', 'running'].includes(jobId ? getJob(jobId)?.status ?? '' : '');

/** A turn or a take of this thread is queued or running. */
export const threadBusy = (threadId: string): boolean => takeRunning(threadId) || listMessages(threadId).some((m) => isLive(m.jobId));

/** Why CREATE SONG / CREATE COVER is off: the recipe rules, then a cover's reference and reading. */
export function draftBlockers(thread: ChatThread, yueConfigured: boolean): string[] {
  const id = thread.draft.reference?.referenceId;
  const ref = id ? getReference(id) : null;
  return [...createBlockers(thread.draft.fields, { yueConfigured }), ...coverBlockers(thread.draft, ref?.threadId === thread.id ? ref : null)];
}

export function threadView(thread: ChatThread, yueConfigured: boolean) {
  return {
    id: thread.id, songId: thread.songId, draft: wireDraft(thread.draft), draftNote: thread.draftNote,
    blockers: draftBlockers(thread, yueConfigured),
    messages: messageViews(listMessages(thread.id), { job: jobView, proposal: proposalLife, versionExists, hasSong: thread.songId !== null }),
    references: listReferences(thread.id).map((r) => referenceView(r)),
  };
}

/** UNDO TURN, read and written in one transaction: a draft write that fails leaves the body without `undone`. */
const undoTurn = db.transaction((threadId: string, messageId: string, busy: boolean): UndoResult | null => {
  const thread = threadById(threadId);
  const message = messageById(messageId);
  if (!thread || !message || message.threadId !== threadId) return null;
  const body = message.kind === 'recipe' ? (message.body as RecipeBody | null) : null;
  const out = draftUndo(thread.draft, body, { hasSong: thread.songId !== null, busy });
  if (!out.ok || !body) return out;
  if (out.draft !== thread.draft && !writeDraft(threadId, thread.draft.rev, out.draft).ok) throw new Error('the draft changed during UNDO TURN');
  updateMessage(messageId, { body: { ...body, undone: undoneRecord(out, Date.now()) } });
  return out;
});

export function makeChatRouter(deps: ChatRouteDeps = defaults): Router {
  const router = Router();
  const view = (t: ChatThread) => threadView(t, deps.yueConfigured());

  router.get('/status', async (_req, res) => { res.json(await deps.status()); });
  router.get('/draft', (_req, res) => { res.json(view(draftThread())); });

  /** NEW CHAT: refused while a turn or a take of the draft thread runs (it would write into nothing). */
  router.post('/draft/reset', (_req, res) => {
    const old = draftThread();
    if (threadBusy(old.id)) return res.status(409).json({ reason: 'the assistant or CREATE SONG is still working in this chat: CANCEL it first' });
    dropProposals(old.id);
    const fresh = resetDraftThread(); // its references cascade; their files go with the sweep
    void sweepFiles().catch((err) => console.error('Reference file sweep failed:', err));
    res.json(view(fresh));
  });

  router.get('/threads/:id', (req, res) => {
    const thread = threadById(req.params.id);
    if (!thread) return res.status(404).json({ error: 'unknown chat' });
    res.json(view(thread));
  });

  router.get('/songs/:songId/thread', (req, res) => {
    const song = db.prepare(`SELECT id FROM songs WHERE id = ? AND trashed_at IS NULL`).get(req.params.songId);
    if (!song) return res.status(404).json({ error: 'unknown song' });
    const thread = songThread(req.params.songId);
    deps.ensureAnalysis?.(req.params.songId); // never throws (analysisTrigger)
    res.json(view(thread));
  });

  router.put('/threads/:id/draft', (req, res) => {
    const { fields, rev } = (req.body ?? {}) as { fields?: unknown; rev?: unknown };
    if (typeof fields !== 'object' || fields === null || Array.isArray(fields) || !Number.isInteger(rev)) {
      return res.status(400).json({ error: 'send {fields, rev}' });
    }
    const thread = threadById(req.params.id);
    if (!thread) return res.status(404).json({ error: 'unknown chat' });
    const blockers = (t: ChatThread) => draftBlockers(t, deps.yueConfigured());
    if (thread.draft.rev !== rev) return res.status(409).json({ ok: false, current: wireDraft(thread.draft), blockers: blockers(thread) });
    const { draft: next, refused } = handEdit(thread.draft, fields as Record<string, unknown>);
    const written = writeDraft(thread.id, thread.draft.rev, next);
    if (!written.ok) return res.status(409).json({ ok: false, current: wireDraft(written.current) });
    res.json({ draft: wireDraft(written.thread.draft), blockers: blockers(written.thread), draftNote: written.thread.draftNote, refused });
  });

  router.post('/threads/:id/messages/:messageId/undo', (req, res) => {
    const out = undoTurn(req.params.id, req.params.messageId, threadBusy(req.params.id));
    if (!out) return res.status(404).json({ error: 'unknown chat or message' });
    if (!out.ok) return res.status(409).json({ error: out.error, reason: out.reason });
    const thread = threadById(req.params.id)!;
    res.json({ draft: wireDraft(thread.draft), blockers: draftBlockers(thread, deps.yueConfigured()), restored: out.restored, kept: out.kept });
  });

  return router;
}

export const chatRouter = makeChatRouter();
