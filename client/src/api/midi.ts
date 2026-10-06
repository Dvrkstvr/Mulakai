/** A YuE2 score as a MIDI file (PLAN.md "Export a Score as MIDI"); yue-server converts. */
import { ApiError } from './http';

async function blob(res: Response): Promise<Blob> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError((body as { error?: string }).error ?? `HTTP ${res.status}`, res.status);
  }
  return res.blob();
}

export const midiApi = {
  /** Any native two-voice score: a cover's in Create, or an .abc file from disk. */
  scoreMidi: async (abc: string): Promise<Blob> => blob(await fetch('/api/scores/midi', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ abc }),
  })),

  /** The song's active take's score; 404 (ApiError) when that take has none. */
  songScoreMidi: async (songId: string): Promise<Blob> => blob(await fetch(`/api/songs/${songId}/score/midi`)),
};
