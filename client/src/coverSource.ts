/** COVER's source audio: the raw upload as-is, or the current audible mix of a library song
 * bounced down client-side (same decode/mix/encode pipeline RemasterAction.tsx uses). */
import { api } from './api';
import { audibleTakes } from './mix/activeLayers';
import { decodeLayers } from './mix/decodeLayers';
import { bounceMix, encodeWav } from './mix/bounceMix';
import type { Source } from './createDraft';

export interface CoverSourceChoice {
  source: Source;
  uploadFile: File | null;
  selectedSongId: string | null;
}

export async function resolveCoverSource({ source, uploadFile, selectedSongId }: CoverSourceChoice): Promise<Blob> {
  if (source === 'upload') {
    if (!uploadFile) throw new Error('choose an audio file to upload');
    return uploadFile;
  }
  if (!selectedSongId) throw new Error('choose a song from your library');
  const detail = await api.songDetail(selectedSongId);
  const audible = audibleTakes(detail.layers);
  if (audible.length === 0) throw new Error('that song has no audible layers to use as a source');
  const mixCtx = new AudioContext();
  const decoded = await decodeLayers(
    audible.map((x, i) => ({ id: String(i), audioUrl: `/audio/${x.version.audio_file}`, volume: x.layer.volume })),
    mixCtx,
  );
  const mixed = await bounceMix(decoded);
  await mixCtx.close();
  return encodeWav(mixed);
}

export const coverSourceReady = ({ source, uploadFile, selectedSongId }: CoverSourceChoice): boolean =>
  source === 'upload' ? !!uploadFile : !!selectedSongId;

/** Identifies the picked source, so work done for one source isn't applied to another. */
export function coverSourceKey({ source, uploadFile, selectedSongId }: CoverSourceChoice): string | null {
  if (source === 'upload') return uploadFile ? `upload:${uploadFile.name}:${uploadFile.size}:${uploadFile.lastModified}` : null;
  return selectedSongId ? `library:${selectedSongId}` : null;
}
