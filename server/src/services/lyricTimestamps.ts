/** Generation-time lyric alignment for the `versions.lyric_timestamps` column. */
import { lyricTimestamp, rawPathFromAudioUrl, type ReleaseTaskParams, type TaskResult } from './acestep.js';

/**
 * Best-effort lyric alignment, fetched at generation time while ACE-Step's
 * artifact sidecar still exists (it lives in ACE-Step's temp dir and is cleaned
 * up later, so it can't be fetched lazily from the editor). Returns a JSON
 * string for the `versions.lyric_timestamps` column, or null when unavailable —
 * a missing sidecar (404), instrumental track, or any error is non-fatal and
 * must never fail the surrounding generation.
 */
export async function fetchLyricTimestampsJson(
  result: TaskResult,
  params: ReleaseTaskParams,
): Promise<string | null> {
  // Everything is inside the try: this is best-effort and must never throw into
  // the surrounding generation — a 404 (no sidecar), instrumental track, or any
  // other error just means "no timestamps".
  try {
    const audioPath = rawPathFromAudioUrl(result.file);
    // ACE-Step's metas.duration is typed as number but comes back as the literal
    // string "N/A" for repaint/regenerate results where it isn't computed — Number()
    // that case is NaN, which the isFinite check below rejects instead of forwarding
    // an unparseable value that ACE-Step's /lyric_timestamp rejects with a 422.
    const duration = Number(result.metas.duration ?? params.audio_duration);
    if (!audioPath || !Number.isFinite(duration) || duration <= 0) return null;
    const aligned = await lyricTimestamp({
      audioPath,
      duration,
      vocalLanguage: params.vocal_language,
      inferenceSteps: params.inference_steps,
      model: params.model,
    });
    if (!aligned.success || aligned.sentence_timestamps.length === 0) return null;
    return JSON.stringify(aligned.sentence_timestamps);
  } catch {
    return null;
  }
}
