/** Generation tasks: submit, poll, download results, lyric timestamps. */
import { config } from '../../config.js';
import { call, fetchWithTimeout } from './http.js';
import type { ReleaseTaskParams, TaskResult, LyricTimestampResult } from './types.js';

/** File extension for a stored/downloaded audio_format value — 'wav32' is still a .wav container. */
export function audioFileExt(audioFormat: string | undefined): string {
  const format = audioFormat ?? 'wav';
  return format === 'wav32' ? 'wav' : format;
}

/**
 * Submit a generation job. `srcAudio` uploads the source file for
 * repaint/cover/lego; `referenceAudio` uploads a saved voice clip for
 * reference-audio style-transfer conditioning (distinct ACE-Step fields,
 * both may be present at once).
 */
export async function releaseTask(
  params: ReleaseTaskParams,
  files?: { srcAudio?: { data: Buffer; filename: string }; referenceAudio?: { data: Buffer; filename: string } },
): Promise<{ task_id: string }> {
  // `output` and `adapter` are ours, not ACE-Step's — they ride on the params
  // object so the existing route allowlists and job plumbing carry them, and are
  // stripped here, at the single point where params actually go over the wire.
  const { output: _output, adapter: _adapter, ...wire } = params;
  if (!files?.srcAudio && !files?.referenceAudio) return call('/release_task', wire);
  const form = new FormData();
  for (const [k, v] of Object.entries(wire)) {
    if (v !== undefined && v !== null) form.append(k, String(v));
  }
  if (files.srcAudio) form.append('src_audio', new Blob([new Uint8Array(files.srcAudio.data)]), files.srcAudio.filename);
  if (files.referenceAudio) {
    form.append('reference_audio', new Blob([new Uint8Array(files.referenceAudio.data)]), files.referenceAudio.filename);
  }
  return call('/release_task', undefined, { method: 'POST', body: form });
}

export async function queryResult(
  taskIds: string[],
): Promise<Array<{ task_id: string; status: 0 | 1 | 2; result: TaskResult[]; progress_text?: string }>> {
  const rows = await call<Array<{ task_id: string; status: 0 | 1 | 2; result: string; progress_text?: string }>>(
    '/query_result',
    { task_id_list: taskIds },
  );
  return rows.map((r) => ({
    ...r,
    result: r.result ? (JSON.parse(r.result) as TaskResult[]) : [],
  }));
}

/**
 * Recover the raw filesystem path ACE-Step embedded in a `/v1/audio?path=...`
 * result URL. `/lyric_timestamp` (and the artifact sidecar it reads) key off
 * that raw path, not the download URL — `query_result` only ever exposes the
 * URL form, so we decode it back here. Returns null if the shape is unexpected.
 */
export function rawPathFromAudioUrl(fileUrl: string): string | null {
  const marker = 'path=';
  const idx = fileUrl.indexOf(marker);
  if (idx === -1) return null;
  const encoded = fileUrl.slice(idx + marker.length).split('&')[0];
  const decoded = decodeURIComponent(encoded);
  return decoded || null;
}

/**
 * Request section/line timestamps for a previously generated sample. Depends on
 * the artifact sidecar ACE-Step writes next to the audio at generation time;
 * throws `HTTP 404` when that sidecar is absent (instrumental, save-memory mode,
 * or expired), which callers treat as "no timestamps" rather than a failure.
 */
export async function lyricTimestamp(params: {
  audioPath: string;
  duration: number;
  vocalLanguage?: string;
  inferenceSteps?: number;
  model?: string;
}): Promise<LyricTimestampResult> {
  return call('/lyric_timestamp', {
    audio_path: params.audioPath,
    duration: params.duration,
    vocal_language: params.vocalLanguage ?? 'en',
    inference_steps: params.inferenceSteps ?? 8,
    ...(params.model ? { model: params.model } : {}),
  });
}

/** Download a generated audio file (result.file is a /v1/audio?path=... url). */
export async function downloadAudio(fileUrl: string): Promise<Buffer> {
  const headers: Record<string, string> = {};
  if (config.acestepApiKey) headers['Authorization'] = `Bearer ${config.acestepApiKey}`;
  // 5x the control-call budget: masters are large and may cross a network to a remote host.
  const res = await fetchWithTimeout(`${config.acestepUrl}${fileUrl}`, { headers }, config.acestepTimeoutMs * 5, 'audio download');
  if (!res.ok) throw new Error(`ACE-Step audio download -> HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}
