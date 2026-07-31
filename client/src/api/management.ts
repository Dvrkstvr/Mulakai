/** Management slice: voices, LoRA/LoKr adapters, lyric-tag probe, output-file metadata. */
import { json, appendParams } from './http';
import type { Voice, Adapter, AdapterList, LyricTag, LyricTagProbeStatus, OutputMetadata } from './types';

export const managementApi = {
  listVoices: (): Promise<Voice[]> => fetch('/api/voices').then((r) => json<Voice[]>(r)),

  uploadVoice: (
    name: string,
    audio: Blob,
    meta: { duration?: number; tags?: string } & Record<string, unknown> = {},
  ): Promise<Voice> => {
    const form = new FormData();
    form.append('name', name);
    form.append('audio', audio, 'voice.mp3');
    appendParams(form, meta);
    return fetch('/api/voices', { method: 'POST', body: form }).then((r) => json<Voice>(r));
  },

  updateVoice: (
    id: string,
    patch: { name?: string; tags?: string; default_audio_influence?: number; default_style_influence?: number },
  ): Promise<Voice> =>
    fetch(`/api/voices/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }).then((r) => json<Voice>(r)),

  deleteVoice: (id: string): Promise<void> =>
    fetch(`/api/voices/${id}`, { method: 'DELETE' }).then((r) => json(r)),

  listAdapters: (): Promise<AdapterList> => fetch('/api/adapters').then((r) => json<AdapterList>(r)),

  /** Rejects (400) when ACE-Step can't load the path — registration validates by loading it. */
  registerAdapter: (name: string, path: string): Promise<Adapter> =>
    fetch('/api/adapters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, path }),
    }).then((r) => json<Adapter>(r)),

  /** null = run on the base model. `warning` means the choice was recorded but ACE-Step
   * hasn't applied it yet (usually: no model loaded) — the next generation applies it. */
  setActiveAdapter: (id: string | null): Promise<{ activeId: string | null; warning?: string }> =>
    fetch('/api/adapters/active', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    }).then((r) => json<{ activeId: string | null; warning?: string }>(r)),

  setAdapterScale: (id: string, scale: number): Promise<Adapter & { warning?: string }> =>
    fetch(`/api/adapters/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scale }),
    }).then((r) => json<Adapter & { warning?: string }>(r)),

  deleteAdapter: (id: string): Promise<{ activeId: string | null; warning?: string }> =>
    fetch(`/api/adapters/${id}`, { method: 'DELETE' })
      .then((r) => json<{ activeId: string | null; warning?: string }>(r)),

  listLyricTags: (): Promise<LyricTag[]> =>
    fetch('/api/lyric-tags').then((r) => json<{ tags: LyricTag[] }>(r)).then((d) => d.tags),

  getLyricTagProbeStatus: (): Promise<LyricTagProbeStatus> =>
    fetch('/api/lyric-tags/status').then((r) => json<LyricTagProbeStatus>(r)),

  probeLyricTags: (): Promise<{ status: string }> =>
    fetch('/api/lyric-tags/probe', { method: 'POST' }).then((r) => json<{ status: string }>(r)),

  stopLyricTagProbe: (): Promise<{ status: string }> =>
    fetch('/api/lyric-tags/probe/stop', { method: 'POST' }).then((r) => json<{ status: string }>(r)),

  getOutputMetadata: (): Promise<OutputMetadata> =>
    fetch('/api/output-metadata').then((r) => json<OutputMetadata>(r)),

  updateOutputMetadata: (
    patch: Partial<Pick<OutputMetadata, 'artist' | 'encoder' | 'id3Version'>>,
  ): Promise<OutputMetadata> =>
    fetch('/api/output-metadata', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }).then((r) => json<OutputMetadata>(r)),
};
