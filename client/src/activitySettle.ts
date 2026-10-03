/** Activity's settle events (PLAN.md "UI Redesign", S3.5): each owning store's transition from
 * running to done or failed, as one DONE or FAILED entry. Pure: activityTracking.ts feeds them
 * each store's previous and next state. */
import type { ActiveGeneration } from './api';
import type { CreateDraft } from './createDraft';
import type { SingleEditorJob, SplitJobState } from './editorJob';
import type { GenerationJob } from './generationStore';
import type { TimingsRun } from './timingsStore';

export type ActivityKind = ActiveGeneration['kind'];

export interface ActivityEntry {
  id: string;
  kind: ActivityKind;
  /** The server job that settled, so RUNNING can drop a stale `/active` snapshot of it. */
  jobId?: string;
  status: 'done' | 'failed';
  at: number;
  songId?: string;
  /** Known up front for a generation; the rest resolve from the song index by `songId`. */
  title?: string;
  /** The lilac result badge on a DONE row ("v5", "+1 LANE", "4 STEMS"). */
  badge?: string;
  /** For a repaint-family job: the layer whose new take names the badge once it's read. */
  layerId?: string;
  error?: string;
  /** Where OPEN goes, if anywhere. */
  opens: 'editor' | 'create' | null;
  /** A failed generation's RETRY reopens Create on this draft, as the Library card's does. */
  draft?: CreateDraft;
  /** That generation's key in generationStore, so its RETRY can clear the failed card too. */
  jobKey?: string;
  /** Starts the job again; false when it couldn't start (its slot is taken). */
  retry?: () => boolean;
  /** Why the last RETRY didn't start, shown on the row. */
  note?: string;
}

let seq = 0;
const nextId = (kind: string) => `${kind}-${Date.now().toString(36)}-${(seq += 1)}`;

const VERSION_KINDS = new Set<ActivityKind>(['repaint', 'regenerate', 'retake']);

export function genSettled(prev: GenerationJob | null, next: GenerationJob | null, at = Date.now()): ActivityEntry | null {
  if (!prev || !next || (prev.stage !== 'loading' && prev.stage !== 'running')) return null;
  if (prev.startedAt !== next.startedAt || (next.stage !== 'done' && next.stage !== 'failed')) return null;
  const base = { id: nextId('generate'), kind: 'generate' as const, jobId: next.jobId || undefined, at, title: next.title };
  return next.stage === 'done'
    ? { ...base, status: 'done', songId: next.songId, badge: 'NEW SONG', opens: next.songId ? 'editor' : null }
    : { ...base, status: 'failed', error: next.error ?? 'generation failed', opens: null, draft: next.draft, jobKey: next.key };
}

/** Each job's settle event, matching jobs across the two states by `key`. */
export function settledEach<J extends { key: string }>(
  prev: J[], next: J[], settled: (p: J | null, n: J | null) => ActivityEntry | null,
): ActivityEntry[] {
  if (prev === next) return [];
  const before = new Map(prev.map((j) => [j.key, j]));
  return next.flatMap((j) => settled(before.get(j.key) ?? null, j) ?? []);
}

const EDITOR_BADGE: Partial<Record<ActivityKind, string>> = { addLayer: '+1 LANE', remaster: 'MIX READY' };

/** Repaint, alt take, similar take, add layer and remaster: one of `editorJobs`. */
export function editorSettled(prev: SingleEditorJob | null, next: SingleEditorJob | null, at = Date.now()): ActivityEntry | null {
  if (!prev || !next || prev.stage !== 'running' || prev.startedAt !== next.startedAt || next.stage === 'running') return null;
  const layerId = 'layerId' in next ? next.layerId : undefined;
  const base = { id: nextId(next.kind), kind: next.kind, jobId: next.jobId || undefined, at, songId: next.songId, opens: 'editor' as const };
  return next.stage === 'done'
    ? { ...base, status: 'done', badge: VERSION_KINDS.has(next.kind) ? 'NEW TAKE' : EDITOR_BADGE[next.kind], layerId }
    : { ...base, status: 'failed', error: next.error ?? `${next.kind} failed`, retry: next.retry };
}

/** A split's first pass (or a RE-EXTRACT) settling. The session itself stays open for its stems. */
export function splitSettled(prev: SplitJobState | null, next: SplitJobState | null, at = Date.now()): ActivityEntry | null {
  if (!prev || !next || prev.stage !== 'running' || prev.startedAt !== next.startedAt || next.stage === 'running') return null;
  const base = {
    id: nextId('split'), kind: 'split' as const, jobId: next.splitJobId || undefined, at, songId: next.songId, opens: 'editor' as const,
  };
  if (next.stage === 'failed') return { ...base, status: 'failed', error: next.error ?? 'split failed', retry: next.retry };
  const stems = next.stems.filter((s) => s.status === 'done').length;
  return { ...base, status: 'done', badge: `${stems} STEM${stems === 1 ? '' : 'S'}` };
}

type LocalStage = 'idle' | 'running' | 'failed';

/** TRANSCRIBE and READ LYRICS: their stores go back to `idle` on success. Their results land in
 * Create's cover draft, so OPEN goes there. */
export function localSettled(
  kind: 'transcribe' | 'lyrics', prev: { stage: LocalStage }, next: { stage: LocalStage; error?: string; cancelled?: boolean },
  retry: () => boolean, at = Date.now(),
): ActivityEntry | null {
  // A run cancelled from UP NEXT never ran: no DONE row, and nothing to retry.
  if (prev.stage !== 'running' || next.stage === 'running' || next.cancelled) return null;
  const base = { id: nextId(kind), kind, at, opens: 'create' as const };
  return next.stage === 'idle'
    ? { ...base, status: 'done' }
    : { ...base, status: 'failed', error: next.error ?? `${kind} failed`, retry };
}

/** Word timings are read automatically when a song opens, so only a failure is worth a row:
 * it is the one outcome that needs a person (RETRY). */
export function timingsFailed(
  prev: Record<string, TimingsRun>, next: Record<string, TimingsRun>, retry: (versionId: string) => boolean, at = Date.now(),
): ActivityEntry[] {
  return Object.entries(next)
    .filter(([v, run]) => run.stage === 'failed' && !run.cancelled && prev[v]?.stage === 'running')
    .map(([v, run]) => ({
      id: nextId('timings'), kind: 'timings', status: 'failed', at, opens: null,
      error: run.error ?? 'reading word timings failed', retry: () => retry(v),
    }));
}
