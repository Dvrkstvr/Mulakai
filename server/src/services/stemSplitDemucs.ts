/** Demucs microservice client for the SPLIT feature (DEMUCS_API_URL). */
import path from 'node:path';
import { config } from '../config.js';
import { outputExt } from './audioOutput.js';
import { transcodeBuffer } from './transcode.js';
import { STEM_KINDS, type StemJobLike, type StemKind, type SourceAudio } from './stemSplitTypes.js';

/**
 * Provisional Demucs contract: POST the source audio, expect
 * `{ stems: { vocals, drums, bass, other } }` of downloadable URLs. One
 * deterministic pass — all 4 stems settle together, no partial progress.
 */
export async function runDemucs(job: StemJobLike, src: SourceAudio, outDir: string, isActive: () => boolean): Promise<void> {
  try {
    if (!config.demucsUrl) throw new Error('Demucs is not configured (DEMUCS_API_URL unset)');
    const form = new FormData();
    form.append('audio', new Blob([new Uint8Array(src.data)]), src.filename);
    const res = await fetch(`${config.demucsUrl}/split`, { method: 'POST', body: form });
    if (!res.ok) throw new Error(`Demucs split -> HTTP ${res.status}`);
    const json = (await res.json()) as { stems: Record<StemKind, string> };
    if (!isActive()) return;
    await Promise.all(
      STEM_KINDS.map(async (kind) => {
        const stem = job.stems.find((s) => s.kind === kind);
        if (!stem) return;
        try {
          const url = json.stems[kind];
          if (!url) throw new Error(`missing ${kind} stem in Demucs response`);
          const audioRes = await fetch(url);
          if (!audioRes.ok) throw new Error(`Demucs stem download -> HTTP ${audioRes.status}`);
          const master = Buffer.from(await audioRes.arrayBuffer());
          // demucs-server hands back a lossless float WAV master (see its main.py);
          // the user's container/rate/depth is applied here, same as every other path.
          const filename = `${job.id}-${kind}.${outputExt(job.output)}`;
          await transcodeBuffer(master, path.join(outDir, filename), job.output);
          if (!isActive()) return;
          stem.audioFile = filename;
          stem.status = 'done';
        } catch (err) {
          stem.status = 'failed';
          stem.error = err instanceof Error ? err.message : String(err);
        }
      }),
    );
  } catch (err) {
    if (!isActive()) return;
    const msg = err instanceof Error ? err.message : String(err);
    for (const stem of job.stems) {
      stem.status = 'failed';
      stem.error = msg;
    }
  }
}
