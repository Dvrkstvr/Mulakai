import { useState } from 'react';
import type { RefineResult } from './api';
import { useCreateDraftStore } from './createDraftStore';
import { useLuckyRoll } from './luckySample';

/** FEELING LUCKY on AN IDEA: overwrite the draft with an LM sample. Two-step once the draft
 * holds anything, since it replaces the prompt, lyrics and every song detail at once. */
export function IdeaLucky({ disabled }: { disabled: boolean }) {
  const draft = useCreateDraftStore();
  const patch = useCreateDraftStore((s) => s.patch);
  const { rolling: loading, waitNote, error, roll } = useLuckyRoll();
  const [confirm, setConfirm] = useState(false);
  const { prompt, lyrics, bpm, keyScale, timeSignature, vocalLanguage, duration } = draft;
  const hasDraftContent = !!(prompt || lyrics || bpm || keyScale || timeSignature || vocalLanguage || duration);

  const applySample = (r: RefineResult) => patch({
    formatted: true, prompt: r.caption, lyrics: r.lyrics,
    ...(r.bpm ? { bpm: r.bpm } : {}),
    ...(r.key_scale ? { keyScale: r.key_scale } : {}),
    ...(r.time_signature ? { timeSignature: r.time_signature } : {}),
    ...(r.vocal_language ? { vocalLanguage: r.vocal_language } : {}),
    ...(r.duration ? { duration: r.duration } : {}),
  });

  const run = async () => {
    if (hasDraftContent && !confirm) { setConfirm(true); return; }
    setConfirm(false);
    await roll(applySample);
  };

  return (
    <>
      <button className={loading ? 'lucky-btn loading' : 'lucky-btn'} disabled={loading || disabled} onClick={run}>
        {loading ? 'ROLLING…' : confirm ? 'OVERWRITE? CONFIRM' : 'FEELING LUCKY'}
      </button>
      {confirm && <span className="hint">This will overwrite your current prompt, lyrics, and song details.</span>}
      {waitNote && <span className="hint">{waitNote}</span>}
      {error && <div className="error">{error} <button onClick={run}>RETRY</button></div>}
    </>
  );
}
