/** F-095 (live LD re-check 2): a German lyrics call that times out on gemma4 while Ollama keeps generating. The turn's
 * release gets the cut (model, why) and so waits the longer bound for gemma4 to leave; the slot frees only with
 * `/api/ps` empty. A turn with no cut releases with none (the 10 s bound). */
import { describe, it, expect, afterEach, vi } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mulakai-chatcut-test-'));

const { startFakeOllama } = await import('../../../test-fakes/fakeOllama.js');
const { recipeReply } = await import('../../../test-fakes/chatScripts.js');
const { getRunning, resetQueue } = await import('../genQueue.js');
const { getJob } = await import('../jobRegistry.js');
const { draftThread, resetDraftThread, threadById } = await import('./threadStore.js');
const { appendMessage, listMessages } = await import('./messageStore.js');
const { resetProposals } = await import('./proposalStore.js');
const { startChatTurn, turnDeps } = await import('./turnJob.js');
const { askPlanner } = await import('../score/plannerClient.js');
const { releaseModels } = await import('../score/ollamaControl.js');
type FakeOllama = Awaited<ReturnType<typeof startFakeOllama>>;

const QWEN = 'qwen3:14b';
const GEMMA = 'gemma4:26b-a4b-it-q4_K_M';
const GERMAN = { language: 'de', title: 'Abschied', style: 'German ballad, piano' };
let ollama: FakeOllama;
afterEach(async () => { await ollama?.close(); resetQueue(); resetProposals(); resetDraftThread(); });

function run(timeoutMs: number) {
  const release = vi.fn((models?: string[], cut?: { model: string; why: string }) => releaseModels(ollama.url, models ?? [QWEN], { cut, intervalMs: 5 }));
  const deps = turnDeps({
    planner: { url: ollama.url, model: QWEN }, rung: 0, lyricsModel: () => GEMMA, release,
    ask: (messages, schema, signal, maxTokens, model = QWEN) => askPlanner({ url: ollama.url, model }, messages, schema, { timeoutMs, signal, maxTokens }),
  });
  const thread = threadById(draftThread().id)!;
  const { message } = appendMessage(thread.id, { role: 'user', kind: 'text', text: 'ein Lied', body: { sentRev: thread.draft.rev }, clientKey: crypto.randomUUID() });
  return { thread, release, job: startChatTurn(thread.id, message, null, deps) };
}
const settled = async (id: string) => {
  await vi.waitFor(() => expect(['done', 'failed']).toContain(getJob(id)?.status), { timeout: 5000 });
  await vi.waitFor(() => expect(getRunning()).toBeNull());
  return getJob(id)!;
};

describe('chat turn: a lyrics call cut by the timeout (F-095)', () => {
  it('the release waits for the cut gemma4 generation, then the slot frees with /api/ps empty', async () => {
    ollama = await startFakeOllama({ models: [QWEN, GEMMA], listedPolls: 20 });
    ollama.chats.push(recipeReply(GERMAN));
    ollama.lyrics.push({ hang: true });
    const { thread, release, job } = run(300);
    expect((await settled(job.id)).status).toBe('failed');
    expect(release.mock.calls[0]).toEqual([[QWEN], undefined]); // the hand-off before gemma4: nothing cut yet
    expect(release.mock.calls.at(-1)).toEqual([[QWEN, GEMMA], { model: GEMMA, why: 'timed out after 0 s' }]);
    expect(ollama.resident()).toEqual([]);
    expect(listMessages(thread.id).at(-1)).toMatchObject({ kind: 'failed' });
  });

  it('a turn that ends normally releases with no cut', async () => {
    ollama = await startFakeOllama({ models: [QWEN, GEMMA] });
    ollama.chats.push(recipeReply(GERMAN));
    const { release, job } = run(5000);
    expect((await settled(job.id)).status).toBe('done');
    expect(release.mock.calls.every((c) => c[1] === undefined)).toBe(true);
  });
});
