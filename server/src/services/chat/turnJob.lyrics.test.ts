/** LD-2 (F-095 acceptance, D-233): a recipe turn's lyrics call inside the one `plan` slot, against fakeOllama. English:
 * 2 calls on one model, one release. German: the planner unloaded and `/api/ps` empty before gemma4's call, and every
 * model unloaded with `/api/ps` empty before the slot frees, on success, a failed check, a cancel during each call and
 * an unload that times out. A keep follow-up is one call; a lyrics model not pulled fails the turn naming `ollama pull`. */
import { describe, it, expect, afterEach, vi } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mulakai-chatlyrics-test-'));

const { isLyricsCall, startFakeOllama } = await import('../../../test-fakes/fakeOllama.js');
const { RECIPE, lyricsReply, recipeReply } = await import('../../../test-fakes/chatScripts.js');
const { enqueue, getRunning, resetQueue } = await import('../genQueue.js');
const { getJob } = await import('../jobRegistry.js');
const { draftThread, resetDraftThread, threadById } = await import('./threadStore.js');
const { appendMessage, listMessages } = await import('./messageStore.js');
const { resetProposals } = await import('./proposalStore.js');
const { cancelTurn, startChatTurn, turnDeps } = await import('./turnJob.js');
type FakeOllama = Awaited<ReturnType<typeof startFakeOllama>>;

const QWEN = 'qwen3:14b';
const GEMMA = 'gemma4:26b-a4b-it-q4_K_M';
const GERMAN = { language: 'de', title: 'Abschied', style: 'German ballad, piano, male voice' };
let ollama: FakeOllama;
afterEach(async () => { await ollama?.close(); resetQueue(); resetProposals(); resetDraftThread(); });

const deps = (over: Parameters<typeof turnDeps>[0] = {}) => turnDeps({ planner: { url: ollama.url, model: QWEN }, rung: 0, lyricsModel: (l) => (l === 'de' ? GEMMA : QWEN), ...over });
function send(text: string, over: Parameters<typeof turnDeps>[0] = {}) {
  const thread = threadById(draftThread().id)!;
  const { message } = appendMessage(thread.id, { role: 'user', kind: 'text', text, body: { sentRev: thread.draft.rev }, clientKey: crypto.randomUUID() });
  return { thread, job: startChatTurn(thread.id, message, null, deps(over)) };
}
const settled = async (id: string) => {
  await vi.waitFor(() => expect(['done', 'failed']).toContain(getJob(id)?.status), { timeout: 5000 });
  await vi.waitFor(() => expect(getRunning()).toBeNull());
  return getJob(id)!;
};
const last = (threadId: string) => listMessages(threadId).at(-1)!;
/** The Ollama traffic as one line per step: `chat <model>`, `unload <model>`, `ps <listed>`. */
const log = () => ollama.requests.flatMap((r) => {
  const b = r.body as { model?: string } | null;
  if (r.path === '/v1/chat/completions') return [`chat ${b?.model}${isLyricsCall(r.body) ? ' lyrics' : ''}`];
  if (r.path === '/api/generate') return [`unload ${b?.model}`];
  if (r.path === '/api/ps') return [`ps ${r.listed!.join(',') || '-'}`];
  return [];
});
/** The slot frees only after this: a repaint queued during the turn starts with nothing resident. */
const queueRepaint = () => { let seen: string[] | null = null; enqueue({ kind: 'repaint', jobId: crypto.randomUUID() }, () => { seen = ollama.resident(); }); return () => seen; };

describe('chat turn: the lyrics call inside the slot (LD-2, D-233)', () => {
  it('English: 2 calls on the planner, no unload between, one release at the end', async () => {
    ollama = await startFakeOllama({ models: [QWEN, GEMMA] });
    ollama.chats.push(recipeReply({ language: 'en', title: 'Harbor Lights', style: 'folk, acoustic guitar' }));
    const { thread, job } = send('a folk song about a harbor');
    const repaint = queueRepaint();
    expect((await settled(job.id)).status).toBe('done');
    const steps = log().filter((s) => !s.startsWith('ps'));
    expect(steps).toEqual([`chat ${QWEN}`, `chat ${QWEN} lyrics`, `unload ${QWEN}`]);
    await vi.waitFor(() => expect(repaint()).toEqual([]));
    expect(last(thread.id)).toMatchObject({ kind: 'recipe', body: { recipe: { language: 'en', lyrics: [{ tag: 'Verse' }, { tag: 'Chorus' }, { tag: 'Verse' }, { tag: 'Chorus' }, { tag: 'Outro' }] } } });
  });

  it('German: the planner unloaded and /api/ps empty before gemma4 loads; both unloaded, /api/ps empty, before the slot frees', async () => {
    ollama = await startFakeOllama({ models: [QWEN, GEMMA], listedPolls: 1 });
    ollama.chats.push(recipeReply(GERMAN));
    const { thread, job } = send('ein trauriges Lied über Abschied');
    const repaint = queueRepaint();
    expect((await settled(job.id)).status).toBe('done');
    const steps = log();
    const gemma = steps.indexOf(`chat ${GEMMA} lyrics`);
    expect(steps.slice(0, gemma)).toEqual(expect.arrayContaining([`chat ${QWEN}`, `unload ${QWEN}`, 'ps -']));
    expect(steps.lastIndexOf('ps -', gemma)).toBeGreaterThan(steps.indexOf(`unload ${QWEN}`));
    expect(steps.slice(gemma + 1)).toEqual(expect.arrayContaining([`unload ${QWEN}`, `unload ${GEMMA}`]));
    expect(steps.at(-1)).toBe('ps -');
    await vi.waitFor(() => expect(repaint()).toEqual([]));
    expect(last(thread.id)).toMatchObject({ kind: 'recipe', body: { recipe: { language: 'de', lyrics: [{ lines: ['Der Tag ist still, das Licht so schwach', expect.any(String), expect.any(String), expect.any(String)] }, {}, {}, {}, {}] } } });
  });

  it('German lyrics failing their checks three times: a failed turn with the lyrics reasons, every model unloaded, nothing written', async () => {
    ollama = await startFakeOllama({ models: [QWEN, GEMMA] });
    ollama.chats.push(recipeReply(GERMAN));
    ollama.lyrics.push(lyricsReply(RECIPE.lyrics.map((s) => ({ ...s, lines: ['Mulakai singt', 'Mulakai singt', 'Mulakai singt', 'Mulakai singt'] }))));
    const { thread, job } = send('ein Lied');
    expect((await settled(job.id)).status).toBe('failed');
    expect(log().filter((s) => s.startsWith('chat'))).toEqual([`chat ${QWEN}`, ...Array(3).fill(`chat ${GEMMA} lyrics`)]);
    expect(ollama.resident()).toEqual([]);
    expect(last(thread.id)).toMatchObject({ kind: 'failed', body: { cause: 'check' } });
    expect((last(thread.id).body as { reasons: string[] }).reasons[0]).toContain("contains 'Mulakai'");
    expect(threadById(thread.id)!.draft.rev).toBe(0);
  });

  for (const during of ['planner', 'lyrics'] as const) {
    it(`CANCEL during the ${during} call: aborted, every model unloaded and /api/ps empty before the slot frees`, async () => {
      ollama = await startFakeOllama({ models: [QWEN, GEMMA] });
      if (during === 'planner') ollama.chats.push({ hang: true });
      else { ollama.chats.push(recipeReply(GERMAN)); ollama.lyrics.push({ hang: true }); }
      const { thread, job } = send('ein Lied');
      const asked = during === 'planner' ? `chat ${QWEN}` : `chat ${GEMMA} lyrics`;
      await vi.waitFor(() => expect(log()).toContain(asked));
      if (during === 'lyrics') expect(getJob(job.id)!.progressText).toBe('writing lyrics · gemma4');
      ollama.loaded = during === 'planner' ? QWEN : GEMMA; // a hung call holds its model
      const repaint = queueRepaint();
      expect(cancelTurn(job.id)).toEqual({ aborted: true });
      expect((await settled(job.id)).error).toBe('Aborted');
      await vi.waitFor(() => expect(repaint()).toEqual([]));
      expect(log().at(-1)).toBe('ps -');
      expect(last(thread.id)).toMatchObject({ kind: 'failed', body: { cause: 'cancelled' } });
      expect(threadById(thread.id)!.draft.rev).toBe(0);
    });
  }

  it('an unload that times out before gemma4: the turn fails `unload` naming ollama stop, gemma4 never asked', async () => {
    ollama = await startFakeOllama({ models: [QWEN, GEMMA] });
    ollama.chats.push(recipeReply(GERMAN));
    const release = vi.fn(async (models?: string[]) => { throw new Error(`the planner model ${models![0]} is still loaded after 10 s: run 'ollama stop ${models![0]}'`); });
    const { thread, job } = send('ein Lied', { release });
    expect((await settled(job.id)).status).toBe('failed');
    expect(release.mock.calls.map((c) => c[0])).toEqual([[QWEN], [QWEN]]); // the hand-off, then the finally's release-all
    expect(log()).not.toContain(`chat ${GEMMA} lyrics`);
    expect(last(thread.id)).toMatchObject({ kind: 'failed', body: { cause: 'unload' } });
    expect(last(thread.id).text).toContain(`ollama stop ${QWEN}`);
  });

  it('a "make it faster" follow-up keeps the draft\'s lyrics: one call, no lyrics model loaded', async () => {
    ollama = await startFakeOllama({ models: [QWEN, GEMMA] });
    ollama.chats.push(recipeReply(GERMAN));
    const first = send('ein Lied');
    await settled(first.job.id);
    const lyrics = threadById(first.thread.id)!.draft.fields.lyrics;
    ollama.requests.length = 0;
    ollama.chats.length = 0;
    ollama.chats.push(recipeReply({ ...GERMAN, bpm: 96, lyrics: 'keep' }));
    const { thread, job } = send('mach es schneller');
    expect((await settled(job.id)).status).toBe('done');
    expect(log().filter((s) => !s.startsWith('ps'))).toEqual([`chat ${QWEN}`, `unload ${QWEN}`]);
    expect(threadById(thread.id)!.draft.fields).toMatchObject({ bpm: 96, lyrics });
  });

  it('the lyrics model not pulled: a failed turn naming `ollama pull`, the planner still unloaded, nothing written', async () => {
    ollama = await startFakeOllama({ models: [QWEN] });
    ollama.chats.push(recipeReply(GERMAN));
    const { thread, job } = send('ein Lied');
    expect((await settled(job.id)).status).toBe('failed');
    expect(log().filter((s) => !s.startsWith('ps'))).toEqual([`chat ${QWEN}`, `unload ${QWEN}`]);
    expect(last(thread.id)).toMatchObject({ kind: 'failed', body: { cause: 'check', reasons: [`model ${GEMMA} is not on the planner: run 'ollama pull ${GEMMA}'`] } });
    expect(threadById(thread.id)!.draft.rev).toBe(0);
  });
});
