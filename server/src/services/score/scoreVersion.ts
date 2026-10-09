/**
 * Saves a score render as the base layer's new active version (F-023; D-037, D-038). The sidecar is
 * written FIRST and is load-bearing: a failed write fails the render and leaves no version, since a
 * score version without its score would break the next plan silently. Then the master is transcoded
 * like a first take, and one transaction inserts the version and moves the song's bpm/key/meter/length
 * to the new score's `Q:`/`K:`/`M:`. The previous version stays; revert is `restoreScoreMeta`.
 */
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../../config.js';
import { db } from '../../db/index.js';
import { outputExt, parseOutputSettings } from '../audioOutput.js';
import { readAbcMeta } from '../engines/abcMeta.js';
import type { ScoreRenderRequest } from '../engines/yue2Score.js';
import { readAudioDuration, tagOutputFile } from '../fileTags.js';
import { transcodeBuffer } from '../transcode.js';
import { scoreSidecarName, writeScoreSidecar } from '../versionFiles.js';
import type { Op, Plan } from './planTypes.js';
import type { ScoreSource } from './scoreSource.js';

export interface ScoreRender {
  songId: string;
  plan: Plan;
  source: ScoreSource;
  request: ScoreRenderRequest;
  /** The engine's lossless master. */
  audio: Buffer;
  /** The score the engine says it sang; null = the one that was sent. */
  score: string | null;
  truncated: boolean;
  /** A chat edit (C0b): what the splice did, or why the whole re-render was saved instead (D-101). */
  splice?: SpliceRecord;
}

/** One span's splice: yue-server's result row (bars, joins, gains, snaps, null test). */
export interface SpliceRow {
  kind: 'reharmonize' | 'cut' | 'repeat'; bars: [number, number]; joins_s: number[]; crossfade_s: number[];
  gain_db: unknown; snap_ms: number[]; length_diff_s: number | null; null_test: { samples: number; different: number } | null;
}

/** `params_json.splice`, additive to `score_v: 1` (architecture "Data (chat)", D-266): one span (`splice_v: 1`), the
 * reason the whole song was saved (`splice_v: 1`), or a chain (`splice_v: 2`: its rows in step order, last bar first;
 * `joins_s` are the saved file's times). Readers switch on `splice_v`; an unknown one is label only. */
export type SpliceRecord =
  | ({ splice_v: 1 } & SpliceRow)
  | { splice_v: 1; fallback: string }
  | { splice_v: 2; kind: 'several'; bars: [number, number]; joins_s: number[]; steps: SpliceRow[]; length_diff_s: number | null;
      null_test: { samples: number; different: number } | null };

const SPLICED_WORD = { reharmonize: 'spliced', cut: 'cut', repeat: 'repeated' } as const;

/** " · bars 25–32 spliced", a chain's " · bars 9–16, 41–48 spliced · bars 25–32 cut" (reading order, one group per
 * kind), " · whole song re-rendered: <reason>", or "" for a `splice_v` this build does not know. */
export function spliceSuffix(s: SpliceRecord): string {
  if (s.splice_v === 1) return 'fallback' in s ? ` · whole song re-rendered: ${s.fallback}` : ` · ${barsOf([s.bars])} ${SPLICED_WORD[s.kind]}`;
  if (s.splice_v !== 2 || !Array.isArray(s.steps)) return '';
  const rows = [...s.steps].sort((a, b) => a.bars[0] - b.bars[0]);
  return (['reharmonize', 'cut', 'repeat'] as const).filter((k) => rows.some((r) => r.kind === k))
    .map((k) => ` · ${barsOf(rows.filter((r) => r.kind === k).map((r) => r.bars))} ${SPLICED_WORD[k]}`).join('');
}

/** `bar 43`, `bars 9–16`, `bars 9–16, 43` (a one-bar span is its bar). */
function barsOf(spans: Array<[number, number]>): string {
  const one = spans.length === 1 && spans[0][0] === spans[0][1];
  return `${one ? 'bar' : 'bars'} ${spans.map(([a, b]) => (a === b ? `${a}` : `${a}–${b}`)).join(', ')}`;
}

export interface SavedScoreVersion {
  id: string;
  /** Its place in the base layer's history (v3). */
  number: number;
  seconds: number | null;
  bpm: number | null;
  truncated: boolean;
}

const OP_NAME: Record<Op['op'], (op: never) => string> = {
  SET_TEMPO: (op: Extract<Op, { op: 'SET_TEMPO' }>) => `SET TEMPO ${op.bpm}`,
  REHARMONIZE: (op: Extract<Op, { op: 'REHARMONIZE' }>) => `REHARMONIZE ${op.from_bar === op.to_bar ? op.from_bar : `${op.from_bar}–${op.to_bar}`}`,
  EDIT_STYLE: () => 'EDIT STYLE',
  WRITE_PHRASE: (op: Extract<Op, { op: 'WRITE_PHRASE' }>) => `WRITE PHRASE ${op.instrument} ${op.start_bar}–${op.start_bar + op.bars.length - 1}`,
  TRANSPOSE: (op: Extract<Op, { op: 'TRANSPOSE' }>) => `TRANSPOSE ${op.semitones > 0 ? '+' : ''}${op.semitones}`,
  REPEAT: (op: Extract<Op, { section: number }>) => `REPEAT ${op.label} S${op.section}`,
  CUT: (op: Extract<Op, { section: number }>) => `CUT ${op.label} S${op.section}`,
  REWRITE_LYRICS: (op: Extract<Op, { op: 'REWRITE_LYRICS' }>) => `REWRITE LYRICS ${op.tag} #${op.occurrence}`,
  RETIME: (op: Extract<Op, { op: 'RETIME' }>) => `RE-TIME ${op.bpm}`,
};

/** "score edit · SET TEMPO 88 · REHARMONIZE 17–24", plus " (truncated)". */
export function scoreEditLabel(ops: Op[], truncated: boolean): string {
  return ['score edit', ...ops.map((op) => OP_NAME[op.op](op as never))].join(' · ') + (truncated ? ' (truncated)' : '');
}

function baseOutput(versionId: string): unknown {
  const row = db.prepare(`SELECT params_json FROM versions WHERE id = ?`).get(versionId) as { params_json: string } | undefined;
  try {
    return row ? (JSON.parse(row.params_json) as { output?: unknown }).output : undefined;
  } catch {
    return undefined;
  }
}

export async function persistScoreVersion(
  r: ScoreRender, io: { writeSidecar: (id: string, abc: string) => Promise<void> } = { writeSidecar: writeScoreSidecar },
): Promise<SavedScoreVersion> {
  const { songId, plan, source, request } = r;
  const abc = r.score ?? plan.abc;
  const id = crypto.randomUUID();
  const output = baseOutput(plan.baseVersionId);
  const filename = `${id}.${outputExt(parseOutputSettings(output))}`;
  const filePath = path.join(config.audioDir, filename);
  await io.writeSidecar(id, abc);
  const meta = readAbcMeta(abc);
  let seconds: number | null;
  try {
    await transcodeBuffer(r.audio, filePath, parseOutputSettings(output));
    const title = (db.prepare(`SELECT title FROM songs WHERE id = ?`).get(songId) as { title: string } | undefined)?.title ?? '';
    await tagOutputFile(filePath, { title, bpm: meta.bpm, keyScale: meta.keyScale });
    seconds = readAudioDuration(filePath);
  } catch (err) {
    await Promise.all([filePath, path.join(config.audioDir, scoreSidecarName(id))].map((f) => fs.rm(f, { force: true }).catch(() => {})));
    throw err;
  }
  const params = {
    score_v: 1, engine: 'yue2', task_type: 'score', ...(output === undefined ? {} : { output }),
    request: { style: request.style, lyrics: request.lyrics, seed: request.seed, cot: request.cot }, lyrics: request.lyrics,
    ops: plan.ops, planRequest: plan.request, meta: { ...meta, ...(seconds === null ? {} : { duration: seconds }) },
    basedOn: plan.baseVersionId, ...(plan.retime ? { retime: plan.retime } : {}), ...(r.truncated ? { truncated: true } : {}), ...(r.splice ? { splice: r.splice } : {}),
  };
  const label = scoreEditLabel(plan.ops, r.truncated) + (r.splice ? spliceSuffix(r.splice) : '');
  const layerId = source.baseLayerId;
  db.transaction(() => {
    db.prepare(`UPDATE versions SET active = 0 WHERE layer_id = ?`).run(layerId);
    db.prepare(`INSERT INTO versions (id, layer_id, audio_file, label, params_json, seed, active) VALUES (?, ?, ?, ?, ?, ?, 1)`)
      .run(id, layerId, filename, label, JSON.stringify(params), String(request.seed));
    writeSongMeta(songId, { ...meta, duration: seconds });
    // The song's lyrics follow the version, as activate does (routes/versions.ts): edited ones included.
    if (request.lyrics.trim()) db.prepare(`UPDATE songs SET lyrics = ? WHERE id = ?`).run(request.lyrics, songId);
  })();
  const { n } = db.prepare(`SELECT COUNT(*) AS n FROM versions WHERE layer_id = ?`).get(layerId) as { n: number };
  return { id, number: n, seconds, bpm: meta.bpm, truncated: r.truncated };
}

interface SongMeta { bpm: number | null; keyScale: string; timeSignature: string; duration?: number | null }

function writeSongMeta(songId: string, m: SongMeta): void {
  db.prepare(`UPDATE songs SET bpm = ?, key_scale = ?, time_signature = ?, duration = COALESCE(?, duration) WHERE id = ?`)
    .run(m.bpm, m.keyScale, m.timeSignature, m.duration ?? null, songId);
}

/**
 * On activating a base version of a layer that has a score edit, the song's bpm/key/meter/length
 * follow it: a score version from its `meta` (D-037), a YuE2 first take from its own sidecar's
 * header and audio. A song with no score edit keeps whatever the user set.
 */
export async function restoreScoreMeta(v: { id: string; layer_id: string; song_id: string; audio_file: string; params_json: string }): Promise<void> {
  const p = JSON.parse(v.params_json) as { engine?: unknown; meta?: SongMeta };
  if (p.meta && typeof p.meta === 'object') return writeSongMeta(v.song_id, p.meta);
  const edited = db.prepare(`SELECT 1 FROM versions WHERE layer_id = ? AND json_extract(params_json, '$.score_v') IS NOT NULL`).get(v.layer_id);
  if (p.engine !== 'yue2' || !edited) return;
  const abc = await fs.readFile(path.join(config.audioDir, scoreSidecarName(v.id)), 'utf8').catch(() => null);
  if (abc === null) return;
  writeSongMeta(v.song_id, { ...readAbcMeta(abc), duration: readAudioDuration(path.join(config.audioDir, v.audio_file)) });
}
