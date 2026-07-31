/** Generation slice: the three song-creating tasks, prompt tooling, and job/lock status. */
import { json, appendParams } from './http';
import type { ModelInventory, RefineResult, ActiveGeneration, StemKind } from './types';

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

  /** "Describe this audio for me" — ACE-Step's `/v1/analyze_audio`, same dual-source shape
   * as `generateComplete`'s source param (a direct upload, or a reference into an already-run
   * scratch split job's stem). Returns the same caption/lyrics/metadata shape as `refineInput`. */
  analyzeSourceAudio: (
    source: { file: Blob } | { scratchJobId: string; scratchStemKind: StemKind },
    model: string,
  ): Promise<RefineResult> => {
    const form = new FormData();
    if ('file' in source) {
      form.append('src_audio', source.file, 'source.wav');
    } else {
      form.append('scratch_job_id', source.scratchJobId);
      form.append('scratch_stem_kind', source.scratchStemKind);
    }
    form.append('model', model);
    return fetch('/api/generate/analyze-audio', { method: 'POST', body: form }).then((r) => json<RefineResult>(r));
  },

  refineInput: (params: { prompt: string; lyrics: string } & Record<string, unknown>): Promise<RefineResult> =>
    fetch('/api/generate/format', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    }).then((r) => json<RefineResult>(r)),

  randomSample: (sampleType: 'simple_mode' | 'custom_mode' = 'custom_mode'): Promise<RefineResult> =>
    fetch('/api/generate/random-sample', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sample_type: sampleType }),
    }).then((r) => json<RefineResult>(r)),

  sampleFromQuery: (query: string): Promise<RefineResult> =>
    fetch('/api/generate/sample-from-query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    }).then((r) => json<RefineResult>(r)),

  listModels: (): Promise<ModelInventory> =>
    fetch('/api/generate/models').then((r) => json<ModelInventory>(r)),

  jobStatus: (jobId: string): Promise<{
    status: 'loading' | 'running' | 'done' | 'failed'; songId?: string; error?: string;
    progress?: number; progressStage?: string; progressText?: string;
  }> =>
    fetch(`/api/generate/${jobId}`).then((r) => json(r)),

  /** The server-wide generation lock, if any — used to rehydrate the library's
   * "generating" card after a page refresh mid-generation. */
  activeGeneration: (): Promise<{ active: ActiveGeneration | null }> =>
    fetch('/api/generate/active').then((r) => json(r)),

  /** Dev convenience: force-stop whatever currently holds the generation lock
   * (any kind, including a Demucs/ACE-Step split) — see Header's status pill. */
  abortActive: (): Promise<{ ok: boolean; aborted: boolean }> =>
    fetch('/api/generate/active/abort', { method: 'POST' }).then((r) => json(r)),

  acestepHealth: (): Promise<{ acestep: boolean }> =>
    fetch('/api/generate/health').then((r) => json(r)),
};
