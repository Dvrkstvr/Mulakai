/**
 * The one resolver for "what is this song's score" (D-037): plan, status and render all
 * read through here. Style, lyrics, seed and score always come from the ACTIVE base
 * version, so a revert restores them with no extra code. First-take params have no
 * `score_v` (shape 0); score versions carry `score_v: 1`. Both keep the render request
 * under `request` ({style, lyrics, seed}).
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../../config.js';
import { db } from '../../db/index.js';
import { scoreSidecarName } from '../versionFiles.js';

export interface BaseVersionFacts {
  id: string;
  /** `params_json.engine`; repaint and other ACE-Step versions carry none (D-043). */
  engine: string | null;
  taskType: string | null;
  scoreV: number;
}

export interface ScoreSource {
  songId: string;
  /** songs.engine: null = ACE-Step. */
  engine: string | null;
  genTask: string | null;
  layerCount: number;
  baseLayerId: string | null;
  baseVersions: BaseVersionFacts[];
  activeVersionId: string | null;
  /** The active version's `${versionId}.abc` sidecar, null when absent. */
  abc: string | null;
  style: string | null;
  lyrics: string | null;
  seed: number | null;
  scoreV: number;
  /** Layers, base versions and the active one: any edit since a plan changes it (F-018 #3). */
  fingerprint: string;
}

interface SongRow { engine: string | null; gen_task: string | null }
interface LayerRow { id: string; kind: string }
interface VersionRow { id: string; params_json: string; active: number }

type Params = { engine?: unknown; task_type?: unknown; score_v?: unknown; request?: { style?: unknown; lyrics?: unknown; seed?: unknown } };

function parseParams(json: string): Params {
  try {
    const p = JSON.parse(json) as unknown;
    return p && typeof p === 'object' ? (p as Params) : {};
  } catch {
    return {};
  }
}

const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const scoreVOf = (p: Params): number => (typeof p.score_v === 'number' ? p.score_v : 0);

async function readSidecar(versionId: string): Promise<string | null> {
  try {
    return await fs.readFile(path.join(config.audioDir, scoreSidecarName(versionId)), 'utf8');
  } catch {
    return null;
  }
}

/** Null for a missing or trashed song. */
export async function loadScoreSource(songId: string): Promise<ScoreSource | null> {
  const song = db.prepare(`SELECT engine, gen_task FROM songs WHERE id = ? AND trashed_at IS NULL`).get(songId) as SongRow | undefined;
  if (!song) return null;
  const layers = db.prepare(`SELECT id, kind FROM layers WHERE song_id = ? ORDER BY position, created_at, id`).all(songId) as LayerRow[];
  const base = layers.find((l) => l.kind === 'base') ?? null;
  const rows = base
    ? db.prepare(`SELECT id, params_json, active FROM versions WHERE layer_id = ? ORDER BY created_at, id`).all(base.id) as VersionRow[]
    : [];
  const parsed = rows.map((r) => ({ row: r, params: parseParams(r.params_json) }));
  const active = parsed.find((v) => v.row.active === 1) ?? null;
  const req = active?.params.request ?? {};
  return {
    songId,
    engine: song.engine,
    genTask: song.gen_task,
    layerCount: layers.length,
    baseLayerId: base?.id ?? null,
    baseVersions: parsed.map(({ row, params }) => ({
      id: row.id, engine: str(params.engine), taskType: str(params.task_type), scoreV: scoreVOf(params),
    })),
    activeVersionId: active?.row.id ?? null,
    abc: active ? await readSidecar(active.row.id) : null,
    style: str(req.style),
    lyrics: str(req.lyrics),
    seed: typeof req.seed === 'number' ? req.seed : null,
    scoreV: active ? scoreVOf(active.params) : 0,
    fingerprint: [layers.map((l) => l.id).join(','), rows.map((r) => r.id).join(','), active?.row.id ?? ''].join('|'),
  };
}
