/** A chat RE-TIME turn (RT-6, F-094; retime.html D1-D5) on the real genQueue against fakeOllama: the planner's RETIME is
 * routed in code after the unload: the dock's plan as an edit card (a cover still on its transcription), the reading
 * re-timed in place with an UNDO TURN body (a song that is not a cover), SET TEMPO when only slightly off (Q-125), a say
 * with the reason when refused, and RETIME with another op sent back (Q-132). */
import { describe, it, expect, afterEach, vi } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mulakai-chatretime-test-'));

const { db } = await import('../../db/index.js');
const { startFakeOllama } = await import('../../../test-fakes/fakeOllama.js');
const { markAnalysis, retimeReply } = await import('../../../test-fakes/chatScripts.js');
const { contract } = await import('../../../test-fakes/fakeYue.js');
const { getRunning, resetQueue } = await import('../genQueue.js');
const { getJob } = await import('../jobRegistry.js');
const { songThread } = await import('./threadStore.js');
const { appendMessage, listMessages } = await import('./messageStore.js');
const { proposalLife, resetProposals } = await import('./proposalStore.js');
const { getPlan, resetPlans } = await import('../score/planStore.js');
const { buildPlan } = await import('../score/planBuild.js');
const { readVersionAnalysis, writeAnalysis } = await import('./analysisStore.js');
const { refusedLine, RETIME_ALONE } = await import('./retimeReply.js');
const { EDITED_SINCE } = await import('../score/retimeOffer.js');
const { startChatTurn, turnDeps } = await import('./turnJob.js');
type FakeOllama = Awaited<ReturnType<typeof startFakeOllama>>;
type ScoreStatus = import('../score/scoreStatus.js').ScoreStatus;
type ApplyResult = import('../score/planTypes.js').ApplyResult;
type Plan = import('../score/planTypes.js').Plan;
type EditBody = import('./chatTypes.js').EditBody;
type VerbFacts = import('./retimeVerb.js').VerbFacts;
type VersionAnalysis = import('./analysisTypes.js').VersionAnalysis;

const facts = contract('read-ok').response.body.facts;
const tempo = contract('apply-set-tempo').response.body as ApplyResult;
const status = (): ScoreStatus => ({
  eligibility: { state: 'eligible' },
  source: { songId: 's', activeVersionId: 'v1', abc: 'X:1', style: 'dark pop', lyrics: '[Verse]\nwalking out', fingerprint: 'f1' } as ScoreStatus['source'],
  read: { ok: true, error: null, messages: [], chordsPresent: true, bpm: 87, seconds: 179.3, tokens: 1832, facts },
});
const COVER: VerbFacts = { dock: { state: 'offered', notationId: 'n1', readBpm: 140 }, reading: null };
const SONG: VerbFacts = { dock: { state: 'none' }, reading: { notationId: 'n1', read: { bpm: 87, bars: 65 }, retimed: null } };

let ollama: FakeOllama;
afterEach(async () => { await ollama?.close(); resetQueue(); resetProposals(); resetPlans(); });

/** The dock's plan as `buildRetimePlan` makes it: one RETIME op, no planner attempts. */
const dockPlan = (songId: string, mode: 'half' | 'double' | 'bpm', bpm: number): Plan => ({
  ...buildPlan({
    id: crypto.randomUUID(), createdAt: Date.now(), songId, source: { activeVersionId: 'v1', fingerprint: 'f1' }, request: 'RE-TIME', facts,
    chordsPresent: true, ops: [{ op: 'RETIME', mode, bpm, from_bpm: 140, dropped_notes: 0, notes: 100 }], applied: tempo, attempts: 0, refusals: [],
  }),
  retime: { notationId: 'n1', readBpm: 140 },
});

/** A song whose playable version has a transcribed reading of read-ok's 65 bars (kept bundle `n1`). */
function setup(verb: VerbFacts) {
  const songId = crypto.randomUUID();
  const layer = crypto.randomUUID();
  const versionId = crypto.randomUUID();
  db.prepare(`INSERT INTO songs (id, title, duration, engine) VALUES (?, 'Rain', 179, 'yue2')`).run(songId);
  db.prepare(`INSERT INTO layers (id, song_id, name, kind, position) VALUES (?, ?, 'Base', 'base', 0)`).run(layer, songId);
  db.prepare(`INSERT INTO versions (id, layer_id, audio_file, params_json, active, created_at) VALUES (?, ?, ?, '{}', 1, '2026-10-01')`)
    .run(versionId, layer, `${versionId}.wav`);
  const read = markAnalysis(versionId);
  writeAnalysis({ ...read, score: { ...read.score, source: 'transcribed', notationId: 'n1' } } as VersionAnalysis);
  const thread = songThread(songId);
  const plan = vi.fn(async (id: string, mode: 'half' | 'double' | 'bpm', bpm: number | null) => dockPlan(id, mode, bpm ?? (mode === 'half' ? 70 : 280)));
  const applyEdit = vi.fn(async () => tempo);
  const retime = {
    facts: async () => verb,
    plan,
    reading: {
      load: async () => ({ files: { a: 'b' }, chords: true }),
      retime: async () => ({ abc: 'X:1 double', measures: 130, bpm: 174, readBpm: 87, vocalNotes: 1, insNotes: 0, notes: 50, droppedNotes: 0,
        leftOut: [], downbeats: Array.from({ length: 131 }, (_, i) => i * 1.375), warnings: [] }),
      readScore: async () => ({ ok: true, error: null, messages: [], chordsPresent: true, tokens: 1,
        facts: { ...facts, header: { ...facts.header, bpm: 174, bars: 130 } } }) as never,
      measure: async () => null,
      readGrid: async () => null,
      now: () => new Date('2026-10-09T10:00:00.000Z'),
    },
  };
  const deps = turnDeps({ planner: { url: ollama.url, model: 'qwen3:14b' }, rung: 0, source: { status: async () => status() }, applyEdit, retime });
  const send = (text: string) => {
    const { message } = appendMessage(thread.id, { role: 'user', kind: 'text', text, body: { sentRev: thread.draft.rev }, clientKey: crypto.randomUUID() });
    return startChatTurn(thread.id, message, songId, deps);
  };
  return { songId, versionId, thread, send, plan, applyEdit };
}
const settled = async (id: string) => {
  await vi.waitFor(() => expect(['done', 'failed']).toContain(getJob(id)?.status), { timeout: 5000 });
  await vi.waitFor(() => expect(getRunning()).toBeNull());
  return getJob(id)!;
};
const last = (threadId: string) => listMessages(threadId).at(-1)!;

describe('chat RE-TIME turn (RT-6, F-094)', () => {
  it('"it\'s half time" on a cover: the dock\'s plan becomes an edit card with RE-TIME HALF (D1)', async () => {
    ollama = await startFakeOllama();
    ollama.chats.push(retimeReply('half'));
    const { songId, thread, send, plan, applyEdit } = setup(COVER);
    expect((await settled(send("it's half time").id)).status).toBe('done');
    expect(plan).toHaveBeenCalledWith(songId, 'half', null);
    expect(applyEdit).not.toHaveBeenCalled();
    const card = last(thread.id);
    const body = card.body as EditBody;
    expect(card).toMatchObject({ kind: 'edit', text: 'Half time.' });
    expect(body.ops).toEqual([expect.objectContaining({ op: 'RETIME', mode: 'half', bpm: 70, from_bpm: 140 })]);
    expect(body.splice).toMatchObject({ splice: false });
    expect(getPlan(songId)).toMatchObject({ id: body.planId, retime: { notationId: 'n1' } });
    expect(proposalLife(card.proposalId!)).toBe('live');
  });

  it('"it\'s really 92 BPM" on a cover: RE-TIME BPM 92 (D2)', async () => {
    ollama = await startFakeOllama();
    ollama.chats.push(retimeReply('bpm', 92));
    const { songId, thread, send, plan } = setup(COVER);
    await settled(send("it's really 92 BPM").id);
    expect(plan).toHaveBeenCalledWith(songId, 'bpm', 92);
    expect((last(thread.id).body as EditBody).ops[0]).toMatchObject({ op: 'RETIME', mode: 'bpm', bpm: 92 });
  });

  it('"that\'s double time" on a song that is not a cover re-times the reading in place, with UNDO TURN\'s facts (D4)', async () => {
    ollama = await startFakeOllama();
    ollama.chats.push(retimeReply('double'));
    const { songId, versionId, thread, send, plan } = setup(SONG);
    await settled(send("that's double time").id);
    expect(plan).not.toHaveBeenCalled();
    const m = last(thread.id);
    expect(m).toMatchObject({ kind: 'say', proposalId: null, body: { retime: { songId, versionId, number: 1, mode: 'double', bpm: 174, fromBpm: 87, fromBars: 65, toBars: 130 } } });
    expect(m.text).toMatch(/double time · 87 → 174 BPM · 65 → 130 bars/i);
    expect(readVersionAnalysis(versionId)).toMatchObject({ readAt: '2026-10-09T10:00:00.000Z', retime: { mode: 'double', bpm: 174 } });
  });

  it('Q-125: "it\'s really 143 BPM" against the 140 read is a SET TEMPO card, said why (D3)', async () => {
    ollama = await startFakeOllama();
    ollama.chats.push(retimeReply('bpm', 143));
    const { thread, send, plan, applyEdit } = setup(COVER);
    await settled(send("it's really 143 BPM").id);
    expect(plan).not.toHaveBeenCalled();
    expect(applyEdit).toHaveBeenCalledWith(expect.anything(), [{ op: 'SET_TEMPO', bpm: 143 }]);
    expect(last(thread.id)).toMatchObject({ kind: 'edit', text: expect.stringMatching(/^143 is within 8 % of the 140 read/), body: { ops: [{ op: 'SET_TEMPO', bpm: 143 }] } });
  });

  it('a refused route is a say with the reason; nothing is planned or re-timed (D5)', async () => {
    ollama = await startFakeOllama();
    ollama.chats.push(retimeReply('half'));
    const { songId, versionId, thread, send, plan } = setup({ dock: { state: 'refused', reason: EDITED_SINCE }, reading: null });
    await settled(send("it's half time").id);
    expect(last(thread.id)).toMatchObject({ kind: 'say', text: refusedLine(EDITED_SINCE), body: null });
    expect(plan).not.toHaveBeenCalled();
    expect(getPlan(songId)).toBeUndefined();
    expect(readVersionAnalysis(versionId)).not.toHaveProperty('retime');
  });

  it('Q-132: RETIME with another op goes back once with the reason, then stands alone', async () => {
    ollama = await startFakeOllama();
    ollama.chats.push(retimeReply('half', undefined, 'Half time, slower.', [{ op: 'SET_TEMPO', bpm: 70 }]), retimeReply('half'));
    const { thread, send } = setup(COVER);
    await settled(send("it's half time, and slower").id);
    const body = last(thread.id).body as EditBody;
    expect(body.ops).toHaveLength(1);
    expect(body.refusals).toEqual([[RETIME_ALONE]]);
  });
});
