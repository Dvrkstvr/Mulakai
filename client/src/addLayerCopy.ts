import { TRACK_NAMES } from './trackNames';
import { queueSuffix } from './queueCopy';
import { editConsequence, type EditConsequence } from './scoreEnds';

/** Tracks that sing, the only ones ADD LAYER offers lyrics for. */
export function sungTrack(trackName: string): boolean {
  return trackName === 'vocals' || trackName === 'backing_vocals';
}

function trackLabel(trackName: string): string {
  return TRACK_NAMES.find((t) => t.value === trackName)?.label ?? trackName;
}

/** The new lane's name: the picked TRACK, or under AUTO the description's first four words. */
export function addLayerName(prompt: string, trackName: string): string {
  if (trackName) return trackLabel(trackName).toLowerCase();
  return prompt.trim().split(/\s+/).slice(0, 4).join(' ');
}

/** `ADD STRINGS`, or `ADD LAYER` under AUTO. */
export function addLayerCommitLabel(trackName: string): string {
  return `ADD ${trackName ? trackLabel(trackName).toUpperCase() : 'LAYER'}`;
}

/** "Adds a STRINGS lane as strings v1, conditioned on the current mix · nothing else changes". */
export function addLayerConsequence(layerName: string, voiceName: string | null = null): string {
  const lane = layerName ? `a ${layerName.toUpperCase()} lane as ${layerName.toLowerCase()} v1` : 'a lane named from its description';
  // The voice is one choice shared with Create (voiceStore): say so, so it never conditions a layer unseen (PR 11).
  const voice = voiceName ? ` · with the voice ${voiceName.toUpperCase()} (the same pick as Create's)` : '';
  return `Adds ${lane}, conditioned on the current mix${voice} · nothing else changes`;
}

/** ADD LAYER's whole consequence line: the lane, when the job starts, and (F-027) that score
 * editing ends while SCORE is open. */
export const addLayerLine = (layerName: string, ahead: number, scoreOpen: boolean, voiceName: string | null = null): EditConsequence =>
  editConsequence(addLayerConsequence(layerName, voiceName) + queueSuffix(ahead), scoreOpen);

/** The lyrics a sung track starts with: the song's, when its field is still empty. Null = leave the field as it is
 * (not a sung track, already typed into, or the song has no lyrics). */
export function lyricsPrefill(trackName: string, draft: string, songLyrics: string): string | null {
  return sungTrack(trackName) && !draft.trim() && songLyrics.trim() ? songLyrics : null;
}
