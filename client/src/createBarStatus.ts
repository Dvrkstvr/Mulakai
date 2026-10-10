/** What the Library's create bar shows while Create is busy (PLAN.md "Create Bar Status Chips",
 * "Create Bar Mirrors Create"): one card for what Create is doing. Pure, so the decisions are
 * tested without a DOM. */
import type { GenerationJob } from './generationStore';
import type { Landed } from './landedStore';
import { fmtElapsed, fmtProgress, isEngineStage, stageDetail } from './genProgress';
import { startsAfter } from './queueCopy';

/** The card's two lines and look. */
export interface CardState {
  label: string;
  title: string;
  /** The second line as prose: what is happening, or what went wrong. */
  note: string;
  /** Working: the AI shader. Waiting in the queue or failed stays plain. */
  ai: boolean;
  failed: boolean;
  /** The shader's progress veil; undefined for none (DESIGN.md "AI states"). */
  veil?: number;
}

interface DraftText {
  title: string;
  titleSuggested: boolean;
  prompt: string;
  lyrics: string;
}

/** What a draft is called: a typed title, else the prompt, else the lyrics' first line. */
export function draftChipText(d: DraftText): string {
  const title = d.titleSuggested ? '' : d.title.trim();
  const lyric = d.lyrics.split('\n').map((l) => l.trim()).find((l) => l && !l.startsWith('['));
  return title || d.prompt.trim() || lyric || 'New song';
}

interface ThinkState {
  phase: 'idle' | 'thinking' | 'revealing';
  query: string;
  position: number | null;
  error: string;
}

/** Quick Start writing a draft from an idea, as Create shows it: THINKING (or QUEUED while it
 * waits its turn), or COULDN'T WRITE once it failed and the idea is still waiting for a RETRY.
 * Stopping it is Activity's CANCEL / ABORT, like any queued job. */
export function thinkChip(s: ThinkState, pendingQuery: string | undefined): CardState | null {
  if (s.phase !== 'idle') {
    return s.position
      ? { label: `QUEUED · #${s.position}`, title: s.query, note: `QUICK START waits its turn · ${startsAfter(s.position)}`, ai: false, failed: false }
      : { label: 'THINKING', title: s.query, note: 'QUICK START is writing the prompt, lyrics and details…', ai: true, failed: false };
  }
  if (s.error && pendingQuery) {
    return { label: "COULDN'T WRITE", title: pendingQuery, note: `${s.error} · RETRY in Create`, ai: false, failed: true };
  }
  return null;
}

/** Song generations in flight, oldest first. Failed ones keep their Library card (with RETRY). */
export const liveGenJobs = (jobs: GenerationJob[]) => jobs.filter((j) => j.stage === 'loading' || j.stage === 'running');

/** The oldest generation in flight as the card: GENERATING (or QUEUED · #n), its title, and a
 * line with elapsed time, progress and stage — what the grid's GeneratingCard used to show.
 * `more` other generations are counted on the same line. */
export function genCard(job: GenerationJob, elapsedMs: number, more: number): CardState {
  const queued = !!job.queuePosition;
  const engine = isEngineStage(job.progressStage);
  const pct = fmtProgress(job.progress);
  const detail = stageDetail(job.progressStage);
  const parts = queued
    ? [startsAfter(job.queuePosition!)]
    : [`${fmtElapsed(elapsedMs)} elapsed`, ...(engine ? [[detail, pct].filter(Boolean).join(' ')] : [pct, detail])];
  if (more) parts.push(`+${more} more in Activity`);
  return {
    label: queued ? `QUEUED · #${job.queuePosition}` : job.stage === 'loading' ? 'LOADING MODEL' : 'GENERATING',
    title: job.title || job.caption || 'Untitled',
    note: parts.filter(Boolean).join(' · '),
    ai: !queued,
    failed: false,
    // An engine's per-stage share would sweep the veil back at every stage, so engines get none.
    veil: queued || engine ? undefined : job.progress,
  };
}

/** A Create take that landed (PLAN.md "The other screens"): LANDED, its title, and where it can go next. Its end
 * offers OPEN IN EDITOR, OPEN CHAT and ✕ instead of TO CREATE. */
export function landedCard(l: Landed): CardState {
  return { label: 'LANDED', title: l.title || 'Untitled', note: 'the first take is in the Library · open it to edit, or talk it over', ai: false, failed: false };
}

/** Which card the bar shows: Quick Start writing, then a generation in flight, then a take that landed, then the
 * held draft. */
export function createCardKind(think: CardState | null, generating: boolean, landed: boolean): 'think' | 'gen' | 'landed' | 'draft' {
  if (think) return 'think';
  if (generating) return 'gen';
  return landed ? 'landed' : 'draft';
}

/** Create is busy — writing a draft, generating a song, holding a draft, or showing a take that landed — so the bar
 * hides FEELING LUCKY and the input and shows the Create card. */
export function isCreateBusy(draftEmpty: boolean, think: CardState | null, generating: boolean, landed = false): boolean {
  return !draftEmpty || think !== null || generating || landed;
}
