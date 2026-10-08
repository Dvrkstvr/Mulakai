/**
 * The kept notation files of a transcription (PLAN.md "Re-time a Transcription", D-207): yue-server forgets
 * a transcription after 24 h or a restart, so the five files SheetSage2 rebuilds a score from are kept here as
 * `DATA_DIR/notation/<sha256>.json`, content-addressed (the same source shares one file). A cover's base version
 * (`params_json.notationId`) and a reading's score part (`notationId`) point at one; a file no row points at is
 * swept once it is 30 days old. Read loosely: a missing or garbled file is "no saved reading", never a crash.
 */
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';
import { db } from '../db/index.js';
import type { NotationBundle } from './score/yueRetime.js';

const ID = /^[0-9a-f]{64}$/;
const REF = /"notationId":"([0-9a-f]{64})"/g;
export const NOTATION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

const dir = () => path.join(config.dataDir, 'notation');
const file = (id: string) => path.join(dir(), `${id}.json`);

export function notationId(bundle: NotationBundle): string {
  const names = Object.keys(bundle.files).sort();
  const canonical = JSON.stringify({ chords: bundle.chords, files: names.map((n) => [n, bundle.files[n]]) });
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

/** Keeps the bundle and returns its id; an existing copy is only touched, so its age restarts. */
export async function saveNotation(bundle: NotationBundle): Promise<string> {
  const id = notationId(bundle);
  await fs.mkdir(dir(), { recursive: true });
  try {
    const now = new Date();
    await fs.utimes(file(id), now, now);
  } catch {
    const tmp = `${file(id)}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify({ notation_v: 1, ...bundle }));
    await fs.rename(tmp, file(id));
  }
  return id;
}

export async function loadNotation(id: string): Promise<NotationBundle | null> {
  if (!ID.test(id)) return null;
  try {
    const raw = JSON.parse(await fs.readFile(file(id), 'utf8')) as { notation_v?: unknown; files?: unknown; chords?: unknown };
    const files = raw.files as Record<string, unknown> | undefined;
    if (raw.notation_v !== 1 || !files || typeof files !== 'object' || !Object.values(files).every((v) => typeof v === 'string')) return null;
    return { files: files as Record<string, string>, chords: raw.chords === true };
  } catch {
    return null;
  }
}

/** Every id a version's params or analysis, or a chat reference's reading (C3), still points at. */
export function referencedNotationIds(): Set<string> {
  const rows = db.prepare(
    `SELECT params_json AS a, analysis_json AS b FROM versions WHERE params_json LIKE '%notationId%' OR analysis_json LIKE '%notationId%'
     UNION ALL SELECT reading_json, NULL FROM chat_references WHERE reading_json LIKE '%notationId%'`,
  ).all() as { a: string | null; b: string | null }[];
  const ids = new Set<string>();
  for (const row of rows) for (const text of [row.a, row.b]) for (const m of (text ?? '').matchAll(REF)) ids.add(m[1]);
  return ids;
}

/** Deletes bundles nothing points at once they are older than `maxAgeMs`. Returns how many went. */
export async function sweepNotation(referenced: Set<string>, now = Date.now(), maxAgeMs = NOTATION_MAX_AGE_MS): Promise<number> {
  let names: string[];
  try {
    names = await fs.readdir(dir());
  } catch {
    return 0;
  }
  let removed = 0;
  for (const name of names) {
    const id = name.replace(/\.json$/, '');
    if (!ID.test(id) || name === id || referenced.has(id)) continue;
    const stat = await fs.stat(file(id)).catch(() => null);
    if (stat && now - stat.mtimeMs > maxAgeMs) {
      await fs.rm(file(id), { force: true });
      removed++;
    }
  }
  return removed;
}
