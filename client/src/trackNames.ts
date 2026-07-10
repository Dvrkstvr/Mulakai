/** ACE-Step's fixed lego/extract/complete track-type vocabulary (acestep/constants.py's
 * TRACK_NAMES) — sent as `track_name`, which templates the model's own DiT-level
 * instruction string server-side, independent of the free-text prompt field. */
import { AUTO_OPTION } from './songMeta';

const TRACK_NAME_VALUES = [
  'woodwinds', 'brass', 'fx', 'synth', 'strings', 'percussion',
  'keyboard', 'guitar', 'bass', 'drums', 'backing_vocals', 'vocals',
];

const TRACK_NAME_LABELS: Record<string, string> = {
  fx: 'FX',
  backing_vocals: 'Backing Vocals',
};

export const TRACK_NAMES = [
  AUTO_OPTION,
  ...TRACK_NAME_VALUES.map((value) => ({
    label: TRACK_NAME_LABELS[value] ?? value[0].toUpperCase() + value.slice(1),
    value,
  })),
];
