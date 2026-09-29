/**
 * Which reference-audio influence sliders the server actually applies, per Create task. Kept
 * in step with the server: text2music applies style only (ACE-Step neutralizes
 * audio_cover_strength there, upstream #1305); cover and complete never remap either influence
 * (referenceAudioResolve.ts). Cover still shows both sliders with a disclaimer; complete hides
 * them outright so ARRANGE doesn't present dead controls.
 */
export type ReferenceTaskType = 'text2music' | 'cover' | 'complete';

export function influenceSliders(taskType: ReferenceTaskType): { audio: boolean; style: boolean } {
  switch (taskType) {
    case 'text2music': return { audio: false, style: true };
    case 'cover': return { audio: true, style: true };
    case 'complete': return { audio: false, style: false };
  }
}

const pct = (v: number) => `${Math.round(v * 100)}%`;

/** Suffix for the picker's "will condition on …" hint, stating what the reference will do. */
export function influenceHint(taskType: ReferenceTaskType, styleInfluence: number): string {
  switch (taskType) {
    case 'text2music': return ` — style ${pct(styleInfluence)}`;
    case 'cover': return ' — the sliders above don\'t apply here; VARIANCE controls closeness to the source track instead';
    case 'complete': return ' — used as-is; ARRANGE has no influence controls';
  }
}
