/** Library's CONTINUE row data (PLAN.md "UI Redesign", S3.6) and the relative times Activity
 * shares with it. */
import type { RecentSong } from './api';

/** SQLite's `datetime('now')` is UTC without a zone marker. */
export function parseDbTime(s: string): number {
  return Date.parse(s.includes('T') ? s : `${s.replace(' ', 'T')}Z`);
}

export function fmtAgo(then: number, now = Date.now()): string {
  const min = Math.floor((now - then) / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'yesterday' : `${d} days ago`;
}

/** The newest version's label in words: "Repainted 1:32–2:07 · VOCALS". Labels are written by the
 * server (repaintVersion.ts, replayJobs.ts, stemSplit.ts, addLayerJobs.ts, songPersist.ts); anything else is shown
 * as written. */
export function describeEdit(label: string, layerName: string): string {
  const layer = layerName.toUpperCase();
  const l = label.trim();
  let m: RegExpMatchArray | null;
  if (!l || l === 'first generation') return 'Generated';
  if (l === 'add layer') return `Added a ${layer} layer`;
  if ((m = l.match(/^repaint (.+)$/))) return `Repainted ${m[1]} · ${layer}`;
  if ((m = l.match(/^alt:? (.+)$/))) return `Alt take of ${m[1]} · ${layer}`;
  if ((m = l.match(/^similar:? (.+)$/))) return `Similar take of ${m[1]} · ${layer}`;
  if ((m = l.match(/^split: extract (\w+)$/))) return `Split out ${m[1]} · ${layer}`;
  return `${l[0].toUpperCase()}${l.slice(1)} · ${layer}`;
}

export function lastAction(r: RecentSong, now = Date.now()): string {
  return `${describeEdit(r.version_label, r.layer_name)} · ${fmtAgo(parseDbTime(r.edited_at), now)}`;
}
