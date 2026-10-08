/** A marked turn (F-055, D-175, D-176) on the real genQueue against fakeOllama: the prompt carries the MARK block,
 * the schema bounds the bars to it, a reply outside it is retried, and the card carries the mark; a mark that went
 * stale while the turn queued ends the turn with a failed line before the planner is asked anything. */
import { describe, it, expect, afterEach, vi } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mulakai-chatmark-test-'));

const { db } = await import('../../db/index.js');
const { startFakeOllama } = await import('../../../test-fakes/fakeOllama.js');
const { markedEditReply, markAnalysis, sayReply } = await import('../../../test-fakes/chatScripts.js');
const { contract } = await import('../../../test-fakes/fakeYue.js');
const { getRunning, resetQueue } = await import('../genQueue.js');
const { getJob } = await import('../jobRegistry.js');
const { songThread } = await import('./threadStore.js');
const { appendMessage, listMessages } = await import('./messageStore.js');
const { resetProposals } = await import('./proposalStore.js');
const { resetPlans } = await import('../score/planStore.js');
const { writeAnalysis } = await import('./analysisStore.js');
const { startChatTurn, turnDeps } = await import('./turnJob.js');
type FakeOllama = Awaited<ReturnType<typeof startFakeOllama>>;
type ScoreStatus = import('../score/scoreStatus.js').ScoreStatus;
type ApplyResult = import('../score/planTypes.js').ApplyResult;
type EditBody = import('./chatTypes.js').EditBody;
type FailedBody = import('./chatTypes.js').FailedBody;
type RangeMark = import('./analysisTypes.js').RangeMark;

const facts = contract('read-ok').response.body.facts;
const applied = contract('apply-reharmonize').response.body as ApplyResult;
const status = (): ScoreStatus => ({
  eligibility: { state: 'eligible' },
  source: { songId: 's', activeVersionId: 'v1', abc: 'X:1', style: 'dark pop', lyrics: '[Verse]\nwalking out', fingerprint: 'f1' } as ScoreStatus['source'],
  read: { ok: true, error: null, messages: [], chordsPresent: true, bpm: 87, seconds: 179.3, tokens: 1832, facts },
});
const reharm = (from: number, to: number) => [{ op: 'REHARMONIZE', from_bar: from, to_bar: to, chords: [{ bar: from, beat: 1, root: 'G', quality: 'm7' }] }];

let ollama: FakeOllama;
const events: string[] = [];
afterEach(async () => { await ollama?.close(); resetQueue(); resetProposals(); resetPlans(); events.length = 0; });

/** A song with base versions v1..vn (the last active), each later one based on the one before with `params`. */
function setup(later: object[] = []) {
  const songId = crypto.randomUUID();
  const layer = crypto.randomUUID();
  db.prepare(`INSERT INTO songs (id, title, duration, engine) VALUES (?, 'Rain', 179, 'yue2')`).run(songId);
  db.prepare(`INSERT INTO layers (id, song_id, name, kind, position) VALUES (?, ?, 'Base', 'base', 0)`).run(layer, songId);
  const ids: string[] = [];
  [{}, ...later].forEach((params, i) => {
    const id = crypto.randomUUID();
    const p = i ? { score_v: 1, engine: 'yue2', task_type: 'score', basedOn: ids[i - 1], ...params } : params;
    db.prepare(`INSERT INTO versions (id, layer_id, audio_file, params_json, active, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
      .run(id, layer, `${id}.wav`, JSON.stringify(p), i === later.length ? 1 : 0, `2026-10-0${i + 1}`);
    writeAnalysis(markAnalysis(id));
    ids.push(id);
  });
  const thread = songThread(songId);
  const d = turnDeps({ planner: { url: ollama.url, model: 'qwen3:14b' }, rung: 0, source: { status: async () => status() }, applyEdit: async () => applied });
  const deps = { ...d, release: async () => { events.push('unload'); return d.release(); } };
  const send = (text: string, mark: RangeMark) => {
    const { message } = appendMessage(thread.id, { role: 'user', kind: 'text', text, body: { sentRev: thread.draft.rev, mark }, clientKey: crypto.randomUUID() });
    return startChatTurn(thread.id, message, songId, deps);
  };
  return { thread, send, ids };
}
const settled = async (id: string) => {
  await vi.waitFor(() => expect(['done', 'failed']).toContain(getJob(id)?.status), { timeout: 5000 });
  await vi.waitFor(() => expect(getRunning()).toBeNull());
  return getJob(id)!;
};
const chatCalls = () => ollama.requests.filter((r) => r.path === '/v1/chat/completions');
type Call = { messages: Array<{ content: string }>; response_format: { json_schema: { schema: Record<string, any> } } };

describe('a marked chat turn (CL-5)', () => {
  it('plans against the marked bars only: MARK in the prompt, bounded schema, an outside reply retried, the mark on the card', async () => {
    ollama = await startFakeOllama();
    ollama.chats.push(markedEditReply(43, 44), markedEditReply(49, 52, 'Jazzier chorus.'));
    const { thread, send, ids } = setup();
    const mark: RangeMark = { kind: 'range', versionId: ids[0], bars: [47, 58], seconds: [128, 160], label: 'CHORUS 1' };
    expect((await settled(send('make this jazzier', mark).id)).status).toBe('done');
    const [first, second] = chatCalls().map((c) => c.body as Call);
    expect(first.messages[1].content).toContain('MARK (the person marked part of v1 on the player; "this", "here" and "it" in the REQUEST mean it): bars 47-58');
    expect(first.messages[1].content).toContain('MARKED SECTIONS: S3 chorus #1 bars 47-62 (partly: bars 47-58)');
    const edit = (first.response_format.json_schema.schema.anyOf as Array<Record<string, any>>).find((p) => p.properties.action.const === 'edit')!;
    const rh = edit.properties.ops.items.anyOf.find((o: Record<string, any>) => o.properties.op.const === 'REHARMONIZE');
    expect(rh.properties.from_bar).toMatchObject({ minimum: 47, maximum: 58 });
    expect(second.messages.at(-1)!.content).toContain('op 1 (REHARMONIZE): bar 43 is outside the mark (bars 47-58)');
    const card = listMessages(thread.id).at(-1)!;
    const body = card.body as EditBody;
    expect(card.kind).toBe('edit');
    expect(body.ops).toEqual(reharm(49, 52));
    expect(body.mark).toEqual({ versionId: ids[0], bars: [47, 58], seconds: [128, 160], notes: [] });
    expect(events).toEqual(['unload']);
  });

  it('a mark that went stale while the turn queued: a failed line, and the planner was never asked (D-175)', async () => {
    ollama = await startFakeOllama();
    const { thread, send, ids } = setup([{ ops: [{ op: 'CUT', section: 2, label: 'verse' }] }]);
    const mark: RangeMark = { kind: 'range', versionId: ids[0], bars: [47, 58], seconds: [128, 160] };
    expect((await settled(send('make this jazzier', mark).id)).status).toBe('failed');
    const failed = listMessages(thread.id).at(-1)!;
    expect(failed.kind).toBe('failed');
    expect(failed.text).toBe('your mark was on v1; v2 moved those bars · nothing changed · mark again');
    expect((failed.body as FailedBody).cause).toBe('stale');
    expect(ollama.requests).toEqual([]);
    expect(events).toEqual([]);
  });

  it('a mark carried from the parent of a version that kept its bars plans on the new version', async () => {
    ollama = await startFakeOllama();
    ollama.chats.push(markedEditReply(49, 52));
    const { thread, send, ids } = setup([{ ops: [{ op: 'SET_TEMPO', bpm: 96 }] }]);
    await settled(send('make this jazzier', { kind: 'range', versionId: ids[0], bars: [47, 58], seconds: [1, 2] }).id);
    expect((listMessages(thread.id).at(-1)!.body as EditBody).mark).toMatchObject({ versionId: ids[1], bars: [47, 58] });
  });

  it('CP-C1 (D-194): a seconds-only mark on a version whose bars are read is bounded to the bars it covers', async () => {
    ollama = await startFakeOllama();
    ollama.chats.push(markedEditReply(49, 52));
    const { thread, send, ids } = setup();
    await settled(send('give this bit jazz chords', { kind: 'range', versionId: ids[0], seconds: [126.5, 159.5] }).id);
    const first = chatCalls()[0].body as Call;
    expect(first.messages[1].content).toContain('bars 47-58, 2:07-2:40.');
    const edit = (first.response_format.json_schema.schema.anyOf as Array<Record<string, any>>).find((p) => p.properties.action.const === 'edit')!;
    const rh = edit.properties.ops.items.anyOf.find((o: Record<string, any>) => o.properties.op.const === 'REHARMONIZE');
    expect(rh.properties.from_bar).toMatchObject({ minimum: 47, maximum: 58 });
    expect((listMessages(thread.id).at(-1)!.body as EditBody).mark).toMatchObject({ bars: [47, 58] });
  });

  it('D-194: a seconds-only mark with no bar times read is answered in words: the schema offers no edit', async () => {
    ollama = await startFakeOllama();
    ollama.chats.push(sayReply('Mark again once the reading lands.'));
    const { thread, send, ids } = setup();
    writeAnalysis({ ...markAnalysis(ids[0]), bars: { notRead: 'YUE2 bar times -> unreadable reply' } });
    expect((await settled(send('give this bit jazz chords', { kind: 'range', versionId: ids[0], seconds: [126.5, 159.5] }).id)).status).toBe('done');
    const first = chatCalls()[0].body as Call;
    const actions = (first.response_format.json_schema.schema.anyOf as Array<Record<string, any>>).map((p) => p.properties.action.const);
    expect(actions).not.toContain('edit');
    expect(actions).toContain('say');
    expect(first.messages[1].content).toContain('no edit can be planned for it');
    expect(listMessages(thread.id).at(-1)!.kind).not.toBe('edit');
  });
});
