/**
 * Which reference-audio influence the server actually applies, per Create task. Kept in step
 * with the server: text2music applies style only (ACE-Step neutralizes audio_cover_strength
 * there, upstream #1305); cover and complete never remap either influence
 * (referenceAudioResolve.ts), so COVER and ARRANGE show no sliders rather than dead controls.
 * AUDIO INFLUENCE therefore never appears on Create — it lives on in Add Layer's VoicePicker.
 */
export type ReferenceTaskType = 'text2music' | 'cover' | 'complete';

export function showsStyleInfluence(taskType: ReferenceTaskType): boolean {
  return taskType === 'text2music';
}

const pct = (v: number) => `${Math.round(v * 100)}%`;

/** Suffix for the picker's "will condition on …" hint, stating what the reference will do. */
export function influenceHint(taskType: ReferenceTaskType, styleInfluence: number): string {
  switch (taskType) {
    case 'text2music': return ` — style ${pct(styleInfluence)}`;
    case 'cover': return ' — used as-is; VARIANCE controls closeness to the source track';
    case 'complete': return ' — used as-is; ARRANGE has no influence controls';
  }
}
