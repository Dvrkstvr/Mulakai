/** Which status chips the Library's create bar shows, and what each one's quick action does
 * (PLAN.md "Create Bar Status Chips"). Pure, so the decisions are tested without a DOM. */
import type { RunningRow } from './activityRunning';
import type { GenerationJob } from './generationStore';
import { fmtProgress, isEngineStage } from './genProgress';

/** Generation chips shown before the rest fold into `+N`. */
export const MAX_GEN_CHIPS = 2;

/** CANCEL takes a queued job out of the queue; ABORT stops the job holding the server's lock. */
export type GenAction = 'cancel' | 'abort';

export interface GenChip {
  key: string;
  jobId: string;
  label: string;
  title: string;
  /** `42%`, when the job reports progress. */
  pct: string | null;
  /** The AI shader's veil; undefined for an engine-stage share (DESIGN.md "AI states"). */
  veil?: number;
  /** Running jobs wear the AI shader; queued ones stay plain, since nothing works on them yet. */
  ai: boolean;
  action: GenAction | null;
}

export interface ChipCopy {
  consequence: string;
  confirm: string;
}

export const CONFIRM_COPY: Record<'clear' | 'stop' | GenAction, ChipCopy> = {
  stop: { consequence: 'Stop writing this draft? Your idea is dropped.', confirm: 'STOP' },
  clear: { consequence: 'Clear this draft? Its prompt, lyrics, settings and reference audio are discarded.', confirm: 'CLEAR' },
  cancel: { consequence: 'Take it out of the queue? Nothing has been made yet, so nothing is lost.', confirm: 'CANCEL' },
  abort: { consequence: 'Abort this generation? The take in progress is lost.', confirm: 'ABORT' },
};

/** The generation jobs Activity's RUNNING section marks as the lock's holder — the only ones
 * ABORT can stop (`runningRows` decides; this just reads its answer back per job key). */
export function abortableGenKeys(rows: RunningRow[]): Set<string> {
  const prefix = 'generate:';
  return new Set(rows.filter((r) => r.abortable && r.key.startsWith(prefix)).map((r) => r.key.slice(prefix.length)));
}

function genChip(job: GenerationJob, abortable: ReadonlySet<string>): GenChip {
  const queued = !!job.queuePosition;
  const action: GenAction | null = queued ? (job.jobId ? 'cancel' : null) : abortable.has(job.key) ? 'abort' : null;
  return {
    key: job.key,
    jobId: job.jobId,
    label: queued ? `QUEUED · #${job.queuePosition}` : 'GENERATING',
    title: job.title || job.caption || 'Untitled',
    pct: queued ? null : fmtProgress(job.progress),
    veil: queued || isEngineStage(job.progressStage) ? undefined : job.progress,
    ai: !queued,
    action,
  };
}

/** One chip per song generation in flight, oldest first, the first `max` of them; `overflow`
 * counts the rest for the `+N` chip. Done and failed jobs keep their Library cards instead. */
export function genChips(jobs: GenerationJob[], abortable: ReadonlySet<string>, max = MAX_GEN_CHIPS) {
  const live = jobs.filter((j) => j.stage === 'loading' || j.stage === 'running');
  return { chips: live.slice(0, max).map((j) => genChip(j, abortable)), overflow: Math.max(0, live.length - max) };
}

interface DraftText {
  title: string;
  titleSuggested: boolean;
  prompt: string;
  lyrics: string;
}

/** What the draft chip names: a typed title, else the prompt, else the lyrics' first line. */
export function draftChipText(d: DraftText): string {
  const title = d.titleSuggested ? '' : d.title.trim();
  const lyric = d.lyrics.split('\n').map((l) => l.trim()).find((l) => l && !l.startsWith('['));
  return title || d.prompt.trim() || lyric || 'New song';
}

export interface ThinkChip {
  label: string;
  title: string;
  /** Thinking wears the AI shader; waiting in the queue or failed stays plain. */
  ai: boolean;
  failed: boolean;
}

interface ThinkState {
  phase: 'idle' | 'thinking' | 'revealing';
  query: string;
  position: number | null;
  error: string;
}

/** Quick Start writing a draft from an idea, as Create shows it: THINKING (or QUEUED while it
 * waits its turn), or COULDN'T WRITE once it failed and the idea is still waiting for a RETRY. */
export function thinkChip(s: ThinkState, pendingQuery: string | undefined): ThinkChip | null {
  if (s.phase !== 'idle') {
    return { label: s.position ? `QUEUED · #${s.position}` : 'THINKING', title: s.query, ai: !s.position, failed: false };
  }
  if (s.error && pendingQuery) return { label: "COULDN'T WRITE", title: pendingQuery, ai: false, failed: true };
  return null;
}
