/**
 * yue-server's re-time routes (PLAN.md "Re-time a Transcription", F-090): a transcription's saved
 * notation files (`GET /v1/transcriptions/{id}/notation`), and the score rebuilt from them at half time,
 * double time or a named BPM (`POST /v1/scores/retime`). yue-server reads and writes the ABC (decision 0002);
 * this only carries it.
 */
import { request, failure, headers, errorMessage, type EngineTarget } from '../engineClient.js';
import { yue2Engine } from '../engines/yue2.js';

/** CPU-only: a rebuild takes under a second, a slow WSL start a few. */
const RETIME_TIMEOUT_MS = 60_000;

/** The five files SheetSage2 rebuilds a score from, base64 by name (about 24 KB). */
export interface NotationBundle {
  files: Record<string, string>;
  /** A chords run (a chat reading, D-131), so a rebuild keeps chord symbols. */
  chords: boolean;
}

export type RetimeMode = 'half' | 'double' | 'bpm';

export interface RetimeResult {
  abc: string;
  measures: number;
  bpm: number | null;
  readBpm: number;
  vocalNotes: number;
  insNotes: number;
  notes: number;
  /** Notes the slower grid cannot hold (SP-8, D-210): said before the person commits. */
  droppedNotes: number;
  /** Sections of the reading left out to match `keepLike` (RT-4). */
  leftOut: string[];
  warnings: string[];
}

/** yue-server refused (422): `code` is its `detail.code` (out_of_range, retime_refused, no_bundle, ...). */
export class RetimeRefused extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/** Null for 404 (a transcription that kept no files, or one yue-server already forgot). */
export async function fetchNotation(target: EngineTarget, yueJobId: string): Promise<NotationBundle | null> {
  const res = await request(target, `/v1/transcriptions/${encodeURIComponent(yueJobId)}/notation`,
    { headers: headers(target) }, 'transcription notation');
  if (res.status === 404) return null;
  if (!res.ok) throw await failure(target, 'transcription notation', res);
  const body = (await res.json()) as { files?: unknown; chords?: unknown };
  const files = body.files && typeof body.files === 'object' && !Array.isArray(body.files) ? body.files as Record<string, unknown> : null;
  if (!files || !Object.values(files).every((v) => typeof v === 'string')) {
    throw new Error(`${target.label} transcription notation -> unreadable reply`);
  }
  return { files: files as Record<string, string>, chords: body.chords === true };
}

export async function retimeScore(
  bundle: NotationBundle, mode: RetimeMode, bpm: number | null, target: EngineTarget = yue2Engine, keepLike?: string,
): Promise<RetimeResult> {
  if (!target.url) throw new Error(`${target.label} is not set up (YUE_API_URL)`);
  const res = await request(target, '/v1/scores/retime', {
    method: 'POST',
    headers: headers(target, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ files: bundle.files, mode, ...(bpm !== null ? { bpm } : {}), melody_only: !bundle.chords,
      ...(keepLike ? { keep_like: keepLike } : {}) }),
  }, 'score retime', RETIME_TIMEOUT_MS);
  if (res.status === 422) {
    const body = (await res.json().catch(() => ({}))) as { detail?: unknown };
    const detail = (body.detail ?? {}) as { code?: unknown };
    throw new RetimeRefused(typeof detail.code === 'string' ? detail.code : 'retime_refused',
      errorMessage(body.detail) ?? 'the score could not be re-timed');
  }
  if (!res.ok) throw await failure(target, 'score retime', res);
  const r = (await res.json()) as Record<string, unknown>;
  if (typeof r.abc !== 'string' || !r.abc) throw new Error(`${target.label} score retime -> no score in reply`);
  return {
    abc: r.abc, measures: num(r.measures), bpm: typeof r.bpm === 'number' ? r.bpm : null, readBpm: num(r.read_bpm),
    vocalNotes: num(r.vocal_notes), insNotes: num(r.ins_notes), notes: num(r.notes), droppedNotes: num(r.dropped_notes),
    leftOut: Array.isArray(r.left_out) ? r.left_out.map(String) : [],
    warnings: Array.isArray(r.warnings) ? r.warnings.map(String) : [],
  };
}
