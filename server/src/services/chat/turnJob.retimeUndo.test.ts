/** RT-6 re-check (F-094) finding 2: a re-time of the reading, UNDO, then the same words again. The planner read the first
 * turn's "Re-timed the reading … 65 → 130 BPM" in its history as still true and answered with a new song (NEW CHAT, 5 of 5
 * live). The stored state after an UNDO (the analysis_json `undoReadingRetime` leaves) makes that history line say the
 * re-time was undone instead; a re-time still in place keeps its line. Real genQueue against fakeOllama. */
import { describe, it, expect, afterEach, vi } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mulakai-chatretimeundo-test-'));

const { db } = await import('../../db/index.js');
const { startFakeOllama } = await import('../../../test-fakes/fakeOllama.js');
const { markAnalysis, retimeReply, sayReply } = await import('../../../test-fakes/chatScripts.js');
const { contract } = await import('../../../test-fakes/fakeYue.js');
const { getRunning, resetQueue } = await import('../genQueue.js');
const { getJob } = await import('../jobRegistry.js');
const { songThread } = await import('./threadStore.js');
const { appendMessage } = await import('./messageStore.js');
const { readVersionAnalysis, writeAnalysis } = await import('./analysisStore.js');
const { undoReadingRetime } = await import('./readingRetime.js');
const { startChatTurn, turnDeps } = await import('./turnJob.js');
const { verbFacts } = await import('./turnRetime.js');
type FakeOllama = Awaited<ReturnType<typeof startFakeOllama>>;
type VersionAnalysis = import('./analysisTypes.js').VersionAnalysis;

const facts = contract('read-ok').response.body.facts;
let ollama: FakeOllama;
afterEach(async () => { await ollama?.close(); resetQueue(); });

/** A song that is not a cover (no score to edit), its playable version holding a transcribed reading of 87 BPM, 65 bars. */
function setup() {
  const songId = crypto.randomUUID();
  const layer = crypto.randomUUID();
  const versionId = crypto.randomUUID();
  db.prepare(`INSERT INTO songs (id, title, duration, engine) VALUES (?, 'eventide', 179, NULL)`).run(songId);
  db.prepare(`INSERT INTO layers (id, song_id, name, kind, position) VALUES (?, ?, 'Base', 'base', 0)`).run(layer, songId);
  db.prepare(`INSERT INTO versions (id, layer_id, audio_file, params_json, active, created_at) VALUES (?, ?, ?, '{}', 1, '2026-10-01')`)
    .run(versionId, layer, `${versionId}.wav`);
  const read = markAnalysis(versionId);
  writeAnalysis({ ...read, score: { ...read.score, source: 'transcribed', notationId: 'n1' } } as VersionAnalysis);
  const thread = songThread(songId);
  const reading = {
    load: async () => ({ files: { a: 'b' }, chords: true }),
    retime: async () => ({ abc: 'X:1 double', measures: 130, bpm: 174, readBpm: 87, vocalNotes: 1, insNotes: 0, notes: 50, droppedNotes: 0,
      leftOut: [], downbeats: Array.from({ length: 131 }, (_, i) => i * 1.375), warnings: [] }),
    readScore: async () => ({ ok: true, error: null, messages: [], chordsPresent: true, tokens: 1,
      facts: { ...facts, header: { ...facts.header, bpm: 174, bars: 130 } } }) as never,
    measure: async () => null,
    readGrid: async () => null,
    now: () => new Date('2026-10-09T10:00:00.000Z'),
  };
  const deps = turnDeps({
    planner: { url: ollama.url, model: 'qwen3:14b' }, rung: 0,
    source: { status: async () => { throw new Error('no score'); } },
    retime: { facts: verbFacts, plan: async () => { throw new Error('unused'); }, reading },
  });
  const send = async (text: string) => {
    const { message } = appendMessage(thread.id, { role: 'user', kind: 'text', text, body: { sentRev: thread.draft.rev }, clientKey: crypto.randomUUID() });
    const job = startChatTurn(thread.id, message, songId, deps);
    await vi.waitFor(() => expect(['done', 'failed']).toContain(getJob(job.id)?.status), { timeout: 5000 });
    await vi.waitFor(() => expect(getRunning()).toBeNull());
  };
  return { versionId, send };
}
/** The user message of the last planner call. */
const lastPrompt = () => {
  const calls = ollama.requests.filter((r) => r.path === '/v1/chat/completions');
  return ((calls.at(-1)!.body as { messages: Array<{ content: string }> }).messages[1]).content;
};

describe('a repeat re-time after UNDO (RT-6 re-check finding 2)', () => {
  it('the undone re-time reads as undone in the next turn\'s history, not as a re-time in place', async () => {
    ollama = await startFakeOllama();
    ollama.chats.push(retimeReply('double'), sayReply());
    const { versionId, send } = setup();
    await send('that reads as double time');
    expect(readVersionAnalysis(versionId)).toMatchObject({ retime: { mode: 'double', bpm: 174 } });
    writeAnalysis(undoReadingRetime(readVersionAnalysis(versionId))!); // the READ AS row's UNDO and UNDO TURN, as the route writes it
    await send('that reads as double time');
    const prompt = lastPrompt();
    expect(prompt).toContain("ASSISTANT: [UNDONE: the person undid this turn's re-time of the reading of v1]");
    expect(prompt).not.toContain('Re-timed the reading');
  });

  it('a re-time still in place keeps its line', async () => {
    ollama = await startFakeOllama();
    ollama.chats.push(retimeReply('double'), sayReply());
    const { send } = setup();
    await send('that reads as double time');
    await send('what tempo is it now?');
    expect(lastPrompt()).toMatch(/ASSISTANT: Re-timed the reading of v1: DOUBLE TIME · 87 → 174 BPM/);
    expect(lastPrompt()).not.toContain('undid');
  });
});
