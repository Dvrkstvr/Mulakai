import { create } from 'zustand';
import { api, type ActiveGeneration, type EngineId, type StemKind } from './api';
import type { CreateDraft } from './createDraft';
import { adoptLock, newGenKey } from './generationJob';
import { pollJob } from './generationPoll';
import { useQueueStore } from './queueStore';

export type GenStage = 'loading' | 'running' | 'done' | 'failed';

export interface GenerationJob {
  /** This tab's handle on the job from the moment it's submitted (the server's `jobId` comes
   * later): several generations can be in flight at once (PLAN.md "UI Redesign", S4.7). */
  key: string;
  jobId: string;
  title: string;
  caption: string;
  stage: GenStage;
  error?: string;
  startedAt: number;
  /** Prefills the Create screen if the user hits RETRY. */
  draft: CreateDraft;
  /** Set once the job finishes — the new song's id, so the caller can load it into the player. */
  songId?: string;
  /** Set while the job waits in the server's queue (1 = next); the stage reads `loading`. */
  queuePosition?: number;
  /** Live progress from ACE-Step's /query_result, refreshed each poll tick while running. */
  progress?: number;
  progressStage?: string;
  progressText?: string;
  /** `chat`: a take the chat started; the chat plays it, the Library's player does not (useAppSync). */
  origin?: 'chat';
}

/** The server's running job when it isn't a song generation (repaint, regenerate, retake, add
 * layer, split, remaster, transcribe, read lyrics, analyze, word timings), from any tab —
 * tracked only so the Editor's automatic word-timings read can wait for a free GPU. */
export interface OtherLock {
  kind: ActiveGeneration['kind'];
  songId?: string;
}

type GenParams = { title: string; prompt: string; lyrics?: string } & Record<string, unknown>;

interface GenerationState {
  /** Every song generation this tab follows, oldest first: one Library card each. */
  jobs: GenerationJob[];
  otherLock: OtherLock | null;
  /** Kicks off a song generation, then polls it to completion independent of whatever
   * view is mounted — CreateView calls this and navigates away immediately afterward.
   * A draft whose `engine` is an extra engine goes to that engine instead of ACE-Step.
   * Every start resolves with the new job's key once the submit has answered. */
  start: (params: GenParams, draft: CreateDraft, referenceAudio?: Blob) => Promise<string>;
  /** Same as `start`, but conditioned on a source audio file — A SONG I HAVE (cover). */
  startFromAudio: (params: GenParams, srcAudio: Blob, draft: CreateDraft, referenceAudio?: Blob) => Promise<string>;
  /** Same shape again, for ONE TRACK — a `complete` generation around a single bare source
   * track, with an optional reference audio file for style/timbre. */
  startComplete: (
    params: { title: string; prompt?: string } & Record<string, unknown>,
    source: { file: Blob } | { scratchJobId: string; scratchStemKind: StemKind },
    draft: CreateDraft,
    referenceAudio?: Blob,
  ) => Promise<string>;
  /** A melody cover from a score on an extra engine (COVER on YUE2) — a new song like the rest. */
  startCover: (engine: EngineId, params: GenParams, draft: CreateDraft) => Promise<string>;
  /** Drops one job's card (a failed one, right before its RETRY reopens Create). */
  dismiss: (key: string) => void;
  /** Rehydrates from the server's running job — call once on app mount, in case a
   * generation was already in flight before a page refresh. */
  hydrate: () => Promise<void>;
  /** Polls the server's running job so `otherLock` stays live and a generation started in
   * another tab gets its own card — see useAppSync's interval. */
  refreshLock: () => Promise<void>;
}

type SetState = (fn: (s: GenerationState) => Partial<GenerationState>) => void;

/** The shared shape of every song-creating submit: show a provisional "loading" card at once,
 * swap in the server's jobId when the submit answers (or fail the card with its error, e.g. a
 * full queue), then poll to completion. The server queues it behind whatever runs. */
async function launch(
  set: SetState, get: () => GenerationState, caption: string, title: string, draft: CreateDraft,
  submit: () => Promise<{ jobId: string }>,
): Promise<string> {
  const key = newGenKey();
  set((s) => ({ jobs: [...s.jobs, { key, jobId: '', title, caption, stage: 'loading', startedAt: Date.now(), draft }] }));
  const patch = (p: Partial<GenerationJob>) => set((s) => ({ jobs: s.jobs.map((j) => (j.key === key ? { ...j, ...p } : j)) }));
  try {
    const { jobId } = await submit();
    patch({ jobId });
    void useQueueStore.getState().poll(); // the next commit's "starts after N jobs" counts this one
    pollJob(jobId, set, get);
  } catch (err) {
    patch({ stage: 'failed', error: err instanceof Error ? err.message : String(err) });
  }
  return key;
}

/** Gives a generation running on the server (after a reload, or started in another tab) its own
 * card, unless this tab already follows it — or has a submit still answering, which may be it. */
function adopt(set: SetState, get: () => GenerationState, active: ActiveGeneration): void {
  const { jobs } = get();
  if (jobs.some((j) => j.jobId === active.jobId || (j.jobId === '' && j.stage === 'loading'))) return;
  set((s) => ({ jobs: [...s.jobs, adoptLock(active)] }));
  if (active.status === 'loading' || active.status === 'running') pollJob(active.jobId, set, get);
}

export const useGenerationStore = create<GenerationState>((set, get) => ({
  jobs: [],
  otherLock: null,

  start: (params, draft, referenceAudio) =>
    launch(set, get, params.prompt || params.lyrics || '', params.title, draft,
      () => (draft.engine && draft.engine !== 'acestep'
        ? api.generateWithEngine(draft.engine, params)
        : api.generate(params, referenceAudio))),

  startCover: (engine, params, draft) =>
    launch(set, get, params.prompt || String(params.lyrics ?? ''), params.title, draft, () => api.coverWithEngine(engine, params)),

  startFromAudio: (params, srcAudio, draft, referenceAudio) =>
    launch(set, get, params.prompt || params.lyrics || '', params.title, draft,
      () => api.generateFromAudio(srcAudio, params, referenceAudio)),

  startComplete: (params, source, draft, referenceAudio) =>
    launch(set, get, params.prompt ?? '', params.title, draft,
      () => api.generateComplete(source, params, referenceAudio)),

  dismiss: (key) => set((s) => ({ jobs: s.jobs.filter((j) => j.key !== key) })),

  hydrate: async () => {
    try {
      const { active } = await api.activeGeneration();
      if (active?.kind === 'generate') adopt(set, get, active);
    } catch {
      // ACE-Step/server unreachable at startup — health check elsewhere already surfaces this
    }
  },

  refreshLock: async () => {
    try {
      const { active } = await api.activeGeneration();
      if (active?.kind === 'generate') adopt(set, get, active);
      const otherLock = active && active.kind !== 'generate' ? { kind: active.kind, songId: active.songId } : null;
      if (otherLock?.kind !== get().otherLock?.kind || otherLock?.songId !== get().otherLock?.songId) set({ otherLock });
    } catch {
      // transient — leave otherLock as-is rather than flicker it off on a network hiccup
    }
  },
}));
