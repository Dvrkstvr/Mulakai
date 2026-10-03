import { describe, it, expect, vi } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mulakai-scorestatus-test-'));

const { db } = await import('../../db/index.js');
const { writeScoreSidecar } = await import('../versionFiles.js');
const { scoreStatus, recheckForRender } = await import('./scoreStatus.js');
const { CHANGED_SINCE_PLAN } = await import('./scoreEligibility.js');
type ScoreRead = import('./yueScoreRead.js').ScoreRead;

/** The recorded yue-server replies (D-039), replayed by abc. */
const CONTRACT = new URL('../../../../yue-server/tests/data/contract/', import.meta.url);
interface Recorded { request: { body: { abc: string; lyrics?: string } }; response: { body: Record<string, unknown> } }
const recorded = (name: string) => JSON.parse(fs.readFileSync(new URL(`${name}.json`, CONTRACT), 'utf8')) as Recorded;
const ok = recorded('read-ok');
const invalid = recorded('read-invalid-sidecar');
/** No chord-free sidecar is recorded: read-ok's reply with chords_present false (what score_check reports for one). */
const CHORD_FREE_ABC = `${ok.request.body.abc}\n% chord-free`;

function fakeRead() {
  return vi.fn(async (abc: string): Promise<ScoreRead> => {
    const body = abc === ok.request.body.abc ? ok.response.body
      : abc === CHORD_FREE_ABC ? { ...ok.response.body, chords_present: false }
        : abc === invalid.request.body.abc ? invalid.response.body : null;
    if (!body) throw new Error('YUE2 read score -> fetch failed');
    return {
      ok: body.ok as boolean, error: body.error as string | null, messages: body.messages as string[],
      chordsPresent: body.chords_present as boolean | null, bpm: body.bpm as number | null,
      seconds: body.seconds as number | null, tokens: body.tokens as number | null, facts: body.facts as ScoreRead['facts'],
    };
  });
}

async function seedYueSong(abc: string | null) {
  const songId = crypto.randomUUID();
  const layerId = crypto.randomUUID();
  const versionId = crypto.randomUUID();
  db.prepare(`INSERT INTO songs (id, title, gen_task, engine) VALUES (?, 'S', 'text2music', 'yue2')`).run(songId);
  db.prepare(`INSERT INTO layers (id, song_id, name, kind, position) VALUES (?, ?, 'Base', 'base', 0)`).run(layerId, songId);
  const params = { engine: 'yue2', task_type: 'text2music', request: { style: 'pop', lyrics: ok.request.body.lyrics, seed: 1 } };
  db.prepare(`INSERT INTO versions (id, layer_id, audio_file, params_json) VALUES (?, ?, ?, ?)`)
    .run(versionId, layerId, `${versionId}.flac`, JSON.stringify(params));
  if (abc) await writeScoreSidecar(versionId, abc);
  return { songId, layerId };
}

/** What persistVersion does when a repaint lands. */
function landRepaint(layerId: string) {
  const id = crypto.randomUUID();
  db.prepare(`UPDATE versions SET active = 0 WHERE layer_id = ?`).run(layerId);
  db.prepare(`INSERT INTO versions (id, layer_id, audio_file, params_json) VALUES (?, ?, ?, '{"task_type":"repaint"}')`)
    .run(id, layerId, `${id}.flac`);
}

const deps = (read = fakeRead()) => ({ read, plannerConfigured: true, yueConfigured: true });

describe('scoreStatus (DB + recorded yue read)', () => {
  it('a YuE2 first take with the recorded valid sidecar is eligible, sending the stored lyrics', async () => {
    const { songId } = await seedYueSong(ok.request.body.abc);
    const d = deps();
    const s = await scoreStatus(songId, d);
    expect(s.eligibility).toEqual({ state: 'eligible' });
    expect(d.read).toHaveBeenCalledWith(ok.request.body.abc, ok.request.body.lyrics);
    expect(s.read?.facts?.header.bars).toBe(65);
    expect(s.source?.fingerprint).toBeTruthy();
  });

  it('the recorded invalid sidecar is ineligible with the checker error', async () => {
    const { songId } = await seedYueSong(invalid.request.body.abc);
    expect((await scoreStatus(songId, deps())).eligibility)
      .toEqual({ state: 'ineligible', reason: 'The saved score fails the checker: group 60, Ins: expected V: Ins.' });
  });

  it('a chord-free score is ineligible', async () => {
    const { songId } = await seedYueSong(CHORD_FREE_ABC);
    expect((await scoreStatus(songId, deps())).eligibility)
      .toEqual({ state: 'ineligible', reason: 'This score has no chords; not supported yet.' });
  });

  it('no sidecar, a repaint version or a second layer is decided without asking yue-server', async () => {
    const noScore = await seedYueSong(null);
    const repainted = await seedYueSong(ok.request.body.abc);
    landRepaint(repainted.layerId);
    const read = fakeRead();
    expect((await scoreStatus(noScore.songId, deps(read))).eligibility.state).toBe('ineligible');
    expect((await scoreStatus(repainted.songId, deps(read))).eligibility.state).toBe('ineligible');
    expect(read).not.toHaveBeenCalled();
  });

  it('yue-server unreachable is offline', async () => {
    const { songId } = await seedYueSong('X:1\nunknown to the fake\n');
    expect((await scoreStatus(songId, deps())).eligibility.state).toBe('offline');
  });

  it('a missing song is hidden', async () => {
    expect((await scoreStatus('nope', deps())).eligibility).toEqual({ state: 'hidden' });
  });
});

describe('recheckForRender (F-018 #3)', () => {
  it('eligible at plan time, a repaint lands before APPLY & RENDER: refused, no yue-server call', async () => {
    const { songId, layerId } = await seedYueSong(ok.request.body.abc);
    const atPlan = await scoreStatus(songId, deps());
    expect(atPlan.eligibility.state).toBe('eligible');
    expect(await recheckForRender(songId, atPlan.source!.fingerprint)).toBeNull();
    landRepaint(layerId);
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    expect(await recheckForRender(songId, atPlan.source!.fingerprint)).toBe(CHANGED_SINCE_PLAN);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('a song trashed since the plan is refused the same way', async () => {
    const { songId } = await seedYueSong(ok.request.body.abc);
    const fp = (await scoreStatus(songId, deps())).source!.fingerprint;
    db.prepare(`UPDATE songs SET trashed_at = datetime('now') WHERE id = ?`).run(songId);
    expect(await recheckForRender(songId, fp)).toBe(CHANGED_SINCE_PLAN);
  });
});
