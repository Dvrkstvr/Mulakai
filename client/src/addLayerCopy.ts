import { TRACK_NAMES } from './trackNames';

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
export function addLayerConsequence(layerName: string): string {
  const lane = layerName ? `a ${layerName.toUpperCase()} lane as ${layerName.toLowerCase()} v1` : 'a lane named from its description';
  return `Adds ${lane}, conditioned on the current mix · nothing else changes`;
}
