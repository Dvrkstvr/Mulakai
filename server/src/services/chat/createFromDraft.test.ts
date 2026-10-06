import { describe, it, expect, afterEach, vi } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mulakai-chatcreate-test-'));

const { RECIPE } = await import('../../../test-fakes/chatScripts.js');
const { createDeps, createFromDraft, withLanguage } = await import('./createFromDraft.js');
const { appendMessage } = await import('./messageStore.js');
const { propose, resetProposals } = await import('./proposalStore.js');
const { draftThread, resetDraftThread, writeDraft } = await import('./threadStore.js');
const { recipeFields } = await import('./draftModel.js');
const { chatStatus } = await import('./chatStatus.js');
const { gatherTurnState } = await import('./songStateSource.js');
const { db } = await import('../../db/index.js');
type Job = import('../jobRegistry.js').Job;

afterEach(() => { resetProposals(); resetDraftThread(); });

/** A draft thread holding RECIPE with a live card. */
function pendingCard(fields = recipeFields(RECIPE)) {
  const t = draftThread();
  writeDraft(t.id, 0, { ...t.draft, rev: 1, fields });
  const proposalId = crypto.randomUUID();
  const { message } = appendMessage(t.id, { role: 'assistant', kind: 'recipe', text: 'x', proposalId });
  propose({ id: proposalId, threadId: t.id, messageId: message.id, createdAt: 0, kind: 'recipe', recipe: RECIPE });
  return { threadId: t.id, proposalId };
}
const start = vi.fn((): Job => ({ id: 'take', taskId: '', status: 'running', createdAt: 0 }));
const deps = (over: Parameters<typeof createDeps>[0] = {}) =>
  createDeps({ engine: { id: 'yue2', url: 'http://yue.test' } as never, plannerConfigured: true, loaded: async () => [], planRunning: () => false, start, ...over });

describe('CREATE SONG re-check (F-044, F-049 #2)', () => {
  it('YUE_API_URL unset: refused with the blocker', async () => {
    const { threadId, proposalId } = pendingCard();
    expect(await createFromDraft(threadId, proposalId, deps({ engine: { id: 'yue2', url: '' } as never })))
      .toEqual({ reason: 'YuE2 is not configured: set YUE_API_URL on the server' });
  });

  it('a planner model on the GPU refuses, unless a plan job holding the slot will unload it', async () => {
    const { threadId, proposalId } = pendingCard();
    const loaded = async () => [{ name: 'qwen3:14b', contextLength: 16384 }];
    expect((await createFromDraft(threadId, proposalId, deps({ loaded })) as { reason: string }).reason).toContain('qwen3:14b');
    expect(await createFromDraft(threadId, proposalId, deps({ loaded, planRunning: () => true }))).toHaveProperty('job');
  });

  it('a card of another thread is expired here', async () => {
    const { proposalId } = pendingCard();
    expect(await createFromDraft('other', proposalId, deps())).toEqual({ reason: 'this chat no longer exists' });
  });
});

describe('the sung language reaches YuE2 in the style (D-112)', () => {
  it('prefixes a language YuE2 does not list, unless the style already says it', () => {
    expect(withLanguage({ prompt: 'slow ballad' }, 'es').prompt).toBe('Spanish, slow ballad');
    expect(withLanguage({ prompt: 'spanish slow ballad' }, 'es').prompt).toBe('spanish slow ballad');
    expect(withLanguage({ prompt: 'ballad' }, 'en').prompt).toBe('ballad');
    expect(withLanguage({ prompt: 'ballad' }, undefined).prompt).toBe('ballad');
  });
});

describe('chat status (D-099)', () => {
  const s = (over = {}) => chatStatus({ llmUrl: 'http://o', yueUrl: 'http://y', probe: async () => null, yueReady: async () => true, ...over });
  it('configured needs both URLs; the assistant is off with the probe\'s cause', async () => {
    expect(await s()).toEqual({ configured: true, assistant: 'ok', cause: null, yue: 'ok' });
    expect(await s({ yueUrl: '' })).toMatchObject({ configured: false, yue: 'off' });
    expect(await s({ probe: async () => 'planner offline: no answer from http://o' })).toMatchObject({ assistant: 'off', cause: 'planner offline: no answer from http://o' });
    expect(await s({ llmUrl: '' })).toMatchObject({ configured: false, assistant: 'off', cause: expect.stringContaining('LLM_API_URL') });
  });
});

describe('song state source', () => {
  it('a song whose score cannot be read: versions in order, the reason, no facts', async () => {
    const songId = crypto.randomUUID();
    const layer = crypto.randomUUID();
    db.prepare(`INSERT INTO songs (id, title, caption) VALUES (?, 'Old', 'rock')`).run(songId);
    db.prepare(`INSERT INTO layers (id, song_id, name, kind) VALUES (?, ?, 'Base', 'base')`).run(layer, songId);
    db.prepare(`INSERT INTO versions (id, layer_id, audio_file, label, active, created_at) VALUES ('v1', ?, 'a', 'first generation', 0, '2026-01-01'), ('v2', ?, 'b', 'score edit', 1, '2026-01-02')`).run(layer, layer);
    db.prepare(`INSERT INTO chat_threads (id, song_id) VALUES ('t-old', ?)`).run(songId);
    const thread = { id: 't-old', songId, draft: { draft_v: 1 as const, rev: 0, fields: {}, touched: {} }, draftNote: null, createdAt: '', updatedAt: '' };
    const got = await gatherTurnState(thread, { status: async () => { throw new Error('yue-server did not answer'); } });
    expect(got.state).toEqual({ hasSong: true, scoreReadable: false });
    expect(got.scoreReason).toBe('yue-server did not answer');
    expect(got.block.join('\n')).toContain('VERSIONS: v1 first generation · v2 score edit (active)');
    expect(got.block.join('\n')).toContain('STYLE: rock');
  });
});
