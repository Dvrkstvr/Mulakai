import { useState } from 'react';
import { api, type RefineResult } from './api';
import { useCreateDraftStore } from './createDraftStore';

/** FEELING LUCKY on AN IDEA: overwrite the draft with an LM sample. Two-step once the draft
 * holds anything, since it replaces the prompt, lyrics and every song detail at once. */
export function IdeaLucky({ disabled }: { disabled: boolean }) {
  const draft = useCreateDraftStore();
  const patch = useCreateDraftStore((s) => s.patch);
  const [loading, setLoading] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState('');
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
    setError('');
    setLoading(true);
    try {
      applySample(await api.randomSample());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button className={loading ? 'lucky-btn loading' : 'lucky-btn'} disabled={loading || disabled} onClick={run}>
        {loading ? 'ROLLING…' : confirm ? 'OVERWRITE? CONFIRM' : 'FEELING LUCKY'}
      </button>
      {confirm && <span className="hint">This will overwrite your current prompt, lyrics, and song details.</span>}
      {error && <div className="error">{error} <button onClick={run}>RETRY</button></div>}
    </>
  );
}
