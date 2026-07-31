/** Editor slice: repaint/versions/layers on an open song, remaster, and stem splits. */
import { outputParams } from '../settings';
import { json, appendParams } from './http';
import type { StemKind, StemResult } from './types';

export const editorApi = {
  repaint: (
    layerId: string,
    params: { prompt: string; start: number; end: number } & Record<string, unknown>,
  ): Promise<{ jobId: string }> =>
    fetch(`/api/layers/${layerId}/repaint`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    }).then((r) => json<{ jobId: string }>(r)),

  activateVersion: (versionId: string): Promise<void> =>
    fetch(`/api/layers/versions/${versionId}/activate`, { method: 'PATCH' }).then(() => undefined),

  deleteVersion: (versionId: string): Promise<void> =>
    fetch(`/api/layers/versions/${versionId}`, { method: 'DELETE' }).then((r) => json(r)),

  regenerateVersion: (versionId: string): Promise<{ jobId: string }> =>
    fetch(`/api/layers/versions/${versionId}/regenerate`, { method: 'POST' }).then((r) => json<{ jobId: string }>(r)),

  retakeVersion: (versionId: string): Promise<{ jobId: string }> =>
    fetch(`/api/layers/versions/${versionId}/retake`, { method: 'POST' }).then((r) => json<{ jobId: string }>(r)),

  addLayer: (
    songId: string,
    mixAudio: Blob,
    params: { prompt: string; layerName: string } & Record<string, unknown>,
  ): Promise<{ jobId: string }> => {
    const form = new FormData();
    form.append('mix_audio', mixAudio, 'mix.wav');
    appendParams(form, params);
    // No explicit Content-Type: the browser sets the multipart boundary itself.
    return fetch(`/api/songs/${songId}/layers`, { method: 'POST', body: form })
      .then((r) => json<{ jobId: string }>(r));
  },

  remaster: (
    songId: string,
    mixAudio: Blob,
    model: string,
    opts: { audioFormat: string; steps: number },
  ): Promise<{ jobId: string }> => {
    const form = new FormData();
    form.append('mix_audio', mixAudio, 'mix.wav');
    form.append('model', model);
    form.append('output', JSON.stringify(outputParams()));
    form.append('steps', String(opts.steps));
    return fetch(`/api/songs/${songId}/remaster`, { method: 'POST', body: form })
      .then((r) => json<{ jobId: string }>(r));
  },

  remasterDownloadUrl: (songId: string, jobId: string): string =>
    `/api/songs/${songId}/remaster/${jobId}/download`,

  updateLayer: (
    layerId: string,
    patch: { name?: string; volume?: number; muted?: boolean; solo?: boolean },
  ): Promise<void> =>
    fetch(`/api/layers/${layerId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }).then((r) => json(r)),

  deleteLayer: (layerId: string): Promise<void> =>
    fetch(`/api/layers/${layerId}`, { method: 'DELETE' }).then((r) => json(r)),

  startSplit: (layerId: string, model: 'acestep' | 'demucs'): Promise<{ jobId: string }> =>
    fetch(`/api/layers/${layerId}/split`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Stems honour the same output format/rate/depth as generation output.
      body: JSON.stringify({ model, output: outputParams() }),
    }).then((r) => json<{ jobId: string }>(r)),

  splitStatus: (jobId: string): Promise<{ status: 'running' | 'done'; stems: StemResult[] }> =>
    fetch(`/api/split/${jobId}`).then((r) => json(r)),

  splitHealth: (): Promise<{ acestep: boolean; demucs: boolean }> =>
    fetch('/api/split/health').then((r) => json(r)),

  claimStem: (jobId: string, kind: StemKind, action: 'replace' | 'add-layer'): Promise<{ songId: string }> =>
    fetch(`/api/split/${jobId}/stems/${kind}/${action}`, { method: 'POST' }).then((r) => json(r)),

  reextractStem: (jobId: string, kind: StemKind): Promise<StemResult> =>
    fetch(`/api/split/${jobId}/stems/${kind}/reextract`, { method: 'POST' }).then((r) => json(r)),

  cancelSplit: (jobId: string): Promise<void> =>
    fetch(`/api/split/${jobId}/cancel`, { method: 'POST' }).then(() => undefined),

  /** Standalone stem split: upload any audio file, no song/library entry created — usable on
   * its own (download the stems) or to pick a source track for Complete generation. */
  splitScratch: (file: Blob, model: 'acestep' | 'demucs'): Promise<{ jobId: string }> => {
    const form = new FormData();
    form.append('audio', file, 'source.wav');
    form.append('model', model);
    // multipart carries no JSON types — the server JSON.parses this field back.
    form.append('output', JSON.stringify(outputParams()));
    return fetch('/api/split/scratch', { method: 'POST', body: form }).then((r) => json<{ jobId: string }>(r));
  },

  scratchSplitStatus: (jobId: string): Promise<{ status: 'running' | 'done'; stems: StemResult[] }> =>
    fetch(`/api/split/scratch/${jobId}`).then((r) => json(r)),

  scratchStemDownloadUrl: (jobId: string, kind: StemKind): string =>
    `/api/split/scratch/${jobId}/${kind}/download`,

  discardScratchSplit: (jobId: string): Promise<void> =>
    fetch(`/api/split/scratch/${jobId}/discard`, { method: 'POST' }).then(() => undefined),
};
