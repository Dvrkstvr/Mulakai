/**
 * RE-TIME on the chat reading (RT-5, F-092; design/retime.html B1-B5, D-212, D-231):
 *   POST /songs/:songId/analysis/retime       {versionId, mode: half | double | bpm, bpm?} → the new `AnalysisView`
 *   POST /songs/:songId/analysis/retime/undo  {versionId} → the view with the reading as SheetSage2 read it
 *   POST /songs/:songId/analysis/again        {versionId} → 202 {jobId}: TRANSCRIBE AGAIN when the kept reading is
 *        gone (D-207); the stored reading is cleared and the version is read from scratch (GPU, one queue slot).
 * Only the playable version's own transcribed reading, never while an analysis reads it. 409 `{reason}` when it
 * cannot be re-timed as it stands, 422 `{code, reason}` when yue-server or the bar fit refused, 502 when yue-server is
 * down; every refusal changes nothing. A reading replaced while it was re-timed is not overwritten (409).
 */
import { Router } from 'express';
import { db } from '../db/index.js';
import { measureScore } from '../services/engineTranscribeClient.js';
import { yue2Engine } from '../services/engines/yue2.js';
import { QueueFullError } from '../services/genQueue.js';
import type { Job } from '../services/jobRegistry.js';
import { loadNotation } from '../services/notationStore.js';
import { retimeScore, type RetimeMode } from '../services/score/yueRetime.js';
import { readScore } from '../services/score/yueScoreRead.js';
import { analysisPending, startAnalysis } from '../services/chat/analysisJob.js';
import { playableVersion, readVersionAnalysis, writeAnalysis } from '../services/chat/analysisStore.js';
import { isFailed, type StoredAnalysis } from '../services/chat/analysisTypes.js';
import { readGrid } from '../services/chat/gridCache.js';
import { retimeReading, undoReadingRetime, type ReadingRetimeDeps } from '../services/chat/readingRetime.js';
import { retimeOffer } from '../services/chat/retimeRecord.js';
import { songAnalysisView } from './chatAnalysis.js';

export interface ChatRetimeDeps extends ReadingRetimeDeps { start: (songId: string) => Job }
const defaults = (): ChatRetimeDeps => ({
  load: loadNotation,
  retime: (bundle, mode, bpm) => retimeScore(bundle, mode, bpm),
  readScore: (abc) => readScore(abc, null, yue2Engine),
  measure: (abc) => measureScore(yue2Engine, abc),
  readGrid,
  now: () => new Date(),
  start: (songId) => startAnalysis(songId),
});

const MODES = new Set(['half', 'double', 'bpm']);
const stamp = (a: StoredAnalysis | null) => (a && !isFailed(a) ? a.readAt : null);
const rawAnalysis = (versionId: string) =>
  (db.prepare(`SELECT analysis_json FROM versions WHERE id = ?`).get(versionId) as { analysis_json: string | null } | undefined)?.analysis_json ?? null;
const setRaw = (versionId: string, raw: string | null) => db.prepare(`UPDATE versions SET analysis_json = ? WHERE id = ?`).run(raw, versionId);

type Target = { songId: string; versionId: string; stored: StoredAnalysis | null } | { status: number; body: object };

/** The playable version the body names, not being read, with its stored reading; else the refusal. */
function target(songId: string, body: unknown): Target {
  const versionId = (body as { versionId?: unknown } | undefined)?.versionId;
  if (typeof versionId !== 'string' || !versionId) return { status: 400, body: { error: 'send {versionId}' } };
  if (!db.prepare(`SELECT 1 FROM songs WHERE id = ? AND trashed_at IS NULL`).get(songId)) return { status: 404, body: { error: 'unknown song' } };
  const take = playableVersion(songId);
  if (take?.id !== versionId) return { status: 409, body: { reason: 'this version is no longer the one playing: nothing changed' } };
  if (analysisPending(songId, versionId)) return { status: 409, body: { reason: `v${take.number} is being read: nothing changed` } };
  return { songId, versionId, stored: readVersionAnalysis(versionId) };
}

export function makeChatRetimeRouter(over: Partial<ChatRetimeDeps> = {}): Router {
  const deps = { ...defaults(), ...over };
  const router = Router();

  router.post('/songs/:songId/analysis/retime', async (req, res) => {
    const { mode, bpm } = (req.body ?? {}) as { mode?: unknown; bpm?: unknown };
    if (!MODES.has(mode as string) || (mode === 'bpm' && !(typeof bpm === 'number' && Number.isInteger(bpm)))) {
      return res.status(400).json({ error: 'send {versionId, mode: half | double | bpm, bpm (a whole number) with bpm}' });
    }
    const t = target(req.params.songId, req.body);
    if ('status' in t) return res.status(t.status).json(t.body);
    const out = await retimeReading(t.stored, { mode: mode as RetimeMode, bpm: mode === 'bpm' ? (bpm as number) : null }, deps);
    if (!out.ok) return res.status(out.status).json(out.status === 409 ? { reason: out.reason } : { code: out.code, reason: out.reason });
    if (stamp(readVersionAnalysis(t.versionId)) !== stamp(t.stored)) return res.status(409).json({ reason: 'the reading changed while it was re-timed: nothing changed' });
    writeAnalysis(out.analysis);
    res.json(songAnalysisView(t.songId));
  });

  router.post('/songs/:songId/analysis/retime/undo', (req, res) => {
    const t = target(req.params.songId, req.body);
    if ('status' in t) return res.status(t.status).json(t.body);
    const back = undoReadingRetime(t.stored);
    if (!back) return res.status(409).json({ reason: 'this reading was not re-timed: nothing to undo' });
    writeAnalysis(back);
    res.json(songAnalysisView(t.songId));
  });

  router.post('/songs/:songId/analysis/again', async (req, res) => {
    const t = target(req.params.songId, req.body);
    if ('status' in t) return res.status(t.status).json(t.body);
    const s = t.stored && !isFailed(t.stored) ? t.stored : null;
    const offer = s ? retimeOffer(s.score, s.retime) : null;
    if (!offer) return res.status(409).json({ reason: 'only a transcribed reading is transcribed again here: RETRY reads a failed one' });
    if (offer.notationId && (await deps.load(offer.notationId))) return res.status(409).json({ reason: 'the saved reading is still here: RE-TIME it' });
    const raw = rawAnalysis(t.versionId);
    setRaw(t.versionId, null); // the job reads only a version with no complete reading
    try {
      res.status(202).json({ jobId: deps.start(t.songId).id });
    } catch (err) {
      setRaw(t.versionId, raw);
      if (!(err instanceof QueueFullError)) throw err;
      res.status(409).json({ reason: err.message });
    }
  });

  return router;
}

export const chatRetimeRouter = makeChatRetimeRouter();
