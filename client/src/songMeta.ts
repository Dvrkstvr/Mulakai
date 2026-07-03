/** Shared AUTO-field option lists for Create view metadata (bpm/key/time signature/
 * language) and their validation sets, used by both the form fields and RefineRail's
 * per-field accept (which must reject LM values outside these lists, e.g. "unknown"). */

export const AUTO_OPTION = { label: 'AUTO', value: '' };

export const TIME_SIGNATURES = [
  AUTO_OPTION,
  { label: '2/4', value: '2' },
  { label: '3/4', value: '3' },
  { label: '4/4', value: '4' },
  { label: '6/8', value: '6' },
];

export const VOCAL_LANGUAGES = [AUTO_OPTION, ...[
  ['en', 'English'], ['zh', 'Chinese'], ['ja', 'Japanese'], ['ko', 'Korean'], ['es', 'Spanish'],
  ['fr', 'French'], ['de', 'German'], ['pt', 'Portuguese'], ['it', 'Italian'], ['ru', 'Russian'],
].map(([value, label]) => ({ label, value }))];

export const KNOWN_TIME_SIGNATURES = new Set(TIME_SIGNATURES.map((o) => o.value).filter(Boolean));
export const KNOWN_VOCAL_LANGUAGES = new Set(VOCAL_LANGUAGES.map((o) => o.value).filter(Boolean));

export function timeSignatureLabel(value: string): string {
  return TIME_SIGNATURES.find((o) => o.value === value)?.label ?? value;
}

export function vocalLanguageLabel(value: string): string {
  return VOCAL_LANGUAGES.find((o) => o.value === value)?.label ?? value;
}
