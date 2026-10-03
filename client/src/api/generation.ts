/** Generation slice: the three song-creating tasks, prompt tooling, and job/lock status. */
import { json, appendParams } from './http';
import type { ModelInventory, RefineResult, ActiveGeneration, StemKind } from './types';
import type { EngineId, EngineInfo } from './engineTypes';
import type { Transcription } from './covers';
import type { LyricsReading } from './lyrics';

export const generationApi = {
  /** Plain JSON unless an ad-hoc reference-audio file is attached (see ReferenceAudioPicker.tsx),
   * in which case it switches to multipart — the server's `/` route accepts both. */
  generate: (
    params: { title: string; prompt: string; lyrics?: string } & Record<string, unknown>,
    referenceAudio?: Blob,
  ): Promise<{ jobId: string }> => {
    if (!referenceAudio) {
      return fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      }).then((r) => json<{ jobId: string }>(r));
    }
    const form = new FormData();
    form.append('reference_audio', referenceAudio, 'reference.wav');
    appendParams(form, params);
    return fetch('/api/generate', { method: 'POST', body: form }).then((r) => json<{ jobId: string }>(r));
  },

  generateFromAudio: (
    srcAudio: Blob,
    params: { title: string; prompt: string; lyrics?: string } & Record<string, unknown>,
    referenceAudio?: Blob,
  ): Promise<{ jobId: string }> => {
    const form = new FormData();
    form.append('src_audio', srcAudio, 'source.wav');
    if (referenceAudio) form.append('reference_audio', referenceAudio, 'reference.wav');
    appendParams(form, params);
    return fetch('/api/generate/from-audio', { method: 'POST', body: form })
      .then((r) => json<{ jobId: string }>(r));
  },

  /** "Complete": generate a full accompaniment around a single bare source track. Source is
   * either a direct upload/library-bounced file, or a reference into an already-run scratch
   * split job's stem (avoids re-downloading+re-uploading a stem produced server-side). */
  generateComplete: (
    source: { file: Blob } | { scratchJobId: string; scratchStemKind: StemKind },
    params: { title: string; prompt?: string } & Record<string, unknown>,
    referenceAudio?: Blob,
  ): Promise<{ jobId: string }> => {
    const form = new FormData();
    if ('file' in source) {
      form.append('src_audio', source.file, 'source.wav');
    } else {
      form.append('scratch_job_id', source.scratchJobId);
      form.append('scratch_stem_kind', source.scratchStemKind);
    }
    if (referenceAudio) form.append('reference_audio', referenceAudio, 'reference.wav');
    appendParams(form, params);
    return fetch('/api/generate/complete', { method: 'POST', body: form }).then((r) => json<{ jobId: string }>(r));
  },

  /** Every engine, ACE-Step first, with live health — see server/src/routes/engines.ts. */
  engines: (): Promise<EngineInfo[]> => fetch('/api/engines').then((r) => json<EngineInfo[]>(r)),

  /** A PROMPT generation on an extra engine. The body uses the same Create field names as
   * `generate`; the server maps them per engine. JSON only: no extra engine takes audio. */
  generateWithEngine: (engine: EngineId, params: Record<string, unknown>): Promise<{ jobId: string }> =>
    fetch(`/api/engines/${engine}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    }).then((r) => json<{ jobId: string }>(r)),

  /** "Describe this audio for me" — ACE-Step's `/v1/analyze_audio`, same dual-source shape
   * as `generateComplete`'s source param (a direct upload, or a reference into an already-run
   * scratch split job's stem). Queued like any job: the polled job's `analysis` carries the
   * same caption/lyrics/metadata shape as `refineInput` (see analyzeJob.ts). */
  analyzeSourceAudio: (
    source: { file: Blob } | { scratchJobId: string; scratchStemKind: StemKind },
    model: string,
  ): Promise<{ jobId: string }> => {
    const form = new FormData();
    if ('file' in source) {
      form.append('src_audio', source.file, 'source.wav');
    } else {
      form.append('scratch_job_id', source.scratchJobId);
      form.append('scratch_stem_kind', source.scratchStemKind);
    }
    form.append('model', model);
    return fetch('/api/generate/analyze-audio', { method: 'POST', body: form }).then((r) => json<{ jobId: string }>(r));
  },

  refineInput: (params: { prompt: string; lyrics: string } & Record<string, unknown>): Promise<RefineResult> =>
    fetch('/api/generate/format', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    }).then((r) => json<RefineResult>(r)),

  /** FEELING LUCKY: queues the LM's random sample; poll `jobStatus` for its `sample`
   * (luckySample.ts). A full queue answers 409 with the reason. */
  randomSample: (sampleType: 'simple_mode' | 'custom_mode' = 'custom_mode'): Promise<{ jobId: string }> =>
    fetch('/api/generate/random-sample', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sample_type: sampleType }),
    }).then((r) => json<{ jobId: string }>(r)),

  sampleFromQuery: (query: string): Promise<RefineResult> =>
    fetch('/api/generate/sample-from-query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    }).then((r) => json<RefineResult>(r)),

  listModels: (): Promise<ModelInventory> =>
    fetch('/api/generate/models').then((r) => json<ModelInventory>(r)),

  jobStatus: (jobId: string): Promise<{
    /** `queued`: waiting in the server's job queue, `queuePosition` (1 = next) in line. */
    status: 'queued' | 'loading' | 'running' | 'done' | 'failed'; songId?: string; error?: string;
    queuePosition?: number;
    /** Set when the job left the queue without running (CANCEL, or its song was trashed). */
    cancelled?: boolean;
    progress?: number; progressStage?: string; progressText?: string;
    /** Only on a finished ANALYZE AUDIO job. */
    analysis?: RefineResult;
    /** Only on a finished FEELING LUCKY job. */
    sample?: RefineResult;
    /** Only on a finished TRANSCRIBE job. */
    transcription?: Transcription;
    /** Only on a finished READ LYRICS job. */
    lyrics?: LyricsReading;
  }> =>
    fetch(`/api/generate/${jobId}`).then((r) => json(r)),

  /** The server's running job, if any — used to rehydrate the library's
   * "generating" card after a page refresh mid-generation. */
  activeGeneration: (): Promise<{ active: ActiveGeneration | null }> =>
    fetch('/api/generate/active').then((r) => json(r)),

  /** Dev convenience: force-stop whatever currently holds the generation lock
   * (any kind, including a Demucs/ACE-Step split) — see Header's status pill. */
  abortActive: (): Promise<{ ok: boolean; aborted: boolean }> =>
    fetch('/api/generate/active/abort', { method: 'POST' }).then((r) => json(r)),

  /** busy: ACE-Step went silent mid-job (it answers nothing while generating), not down. */
  acestepHealth: (): Promise<{ acestep: boolean; busy?: boolean }> =>
    fetch('/api/generate/health').then((r) => json(r)),
};
