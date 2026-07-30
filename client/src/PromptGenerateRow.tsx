import { useState } from 'react';
import { api, type RefineResult } from './api';
import { motion } from 'framer-motion';
import { AIGeneratingBackground } from './AIGeneratingBackground';
import { useSettings, genParams } from './settings';
import { useVoiceStore, voiceParams } from './voiceStore';
import { useGenerationStore } from './generationStore';
import { useCreateDraftStore } from './createDraftStore';
import { ActiveAdapterNote } from './ActiveAdapterNote';
import type { CreateDraft } from './createDraft';

/** The PROMPT tab's two commit actions — FEELING LUCKY (overwrite the draft with an LM sample)
 * and GENERATE — split out of CreatePromptTab.tsx to keep both under the module cap. Reads and
 * writes the shared draft directly, so it needs no state threaded through the form. */
export function PromptGenerateRow({ thinking, onBack }: { thinking: boolean; onBack: () => void }) {
  const gen = useSettings((s) => s.gen);
  const voice = useVoiceStore();
  const draft = useCreateDraftStore();
  const patch = useCreateDraftStore((s) => s.patch);
  const genJob = useGenerationStore((s) => s.job);
  const startGeneration = useGenerationStore((s) => s.start);
  const dismissGeneration = useGenerationStore((s) => s.dismiss);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [luckyLoading, setLuckyLoading] = useState(false);
  const [luckyConfirm, setLuckyConfirm] = useState(false);
  const [luckyError, setLuckyError] = useState('');
  const busy = submitting || !!genJob;

  const { title, prompt, lyrics, bpm, keyScale, timeSignature, vocalLanguage, duration, folderId, formatted } = draft;
  const hasDraftContent = !!(prompt || lyrics || bpm || keyScale || timeSignature || vocalLanguage || duration);

  const generate = async () => {
    setError('');
    setSubmitting(true);
    const retryDraft: CreateDraft = {
      genType: 'prompt', prompt, lyrics, bpm, keyScale, timeSignature, duration,
      ...(folderId ? { folderId, folderName: draft.folderName } : {}),
    };
    // AI ENHANCE re-formats whatever prompt/lyrics it's given — fine for hand-typed text, but
    // re-running it on text the LM already produced is what garbled the sung output (see
    // jobs.ts persistSong). Suppress it for this one generation rather than flipping the
    // persisted setting, so it's back next time you type.
    const effectiveGen = formatted ? { ...gen, useFormat: false } : gen;
    try {
      await startGeneration(
        {
          title: title || 'Untitled', prompt, lyrics,
          ...(bpm > 0 ? { bpm } : {}),
          ...(keyScale ? { key_scale: keyScale } : {}),
          ...(timeSignature ? { time_signature: timeSignature } : {}),
          ...(vocalLanguage ? { vocal_language: vocalLanguage } : {}),
          ...(duration > 0 ? { audio_duration: duration } : {}),
          ...genParams(effectiveGen), ...voiceParams(voice),
          ...(folderId ? { folder_id: folderId } : {}),
        },
        retryDraft,
        voice.uploadedRefFile ?? undefined,
      );
      const failure = useGenerationStore.getState().job;
      if (failure?.stage === 'failed') {
        setError(failure.error ?? 'generation failed');
        dismissGeneration();
        return;
      }
      onBack(); // hands off to the library's GeneratingCard — see generationStore.ts
    } finally {
      setSubmitting(false);
    }
  };

  const applySample = (r: RefineResult) => patch({
    formatted: true, prompt: r.caption, lyrics: r.lyrics,
    ...(r.bpm ? { bpm: r.bpm } : {}),
    ...(r.key_scale ? { keyScale: r.key_scale } : {}),
    ...(r.time_signature ? { timeSignature: r.time_signature } : {}),
    ...(r.vocal_language ? { vocalLanguage: r.vocal_language } : {}),
    ...(r.duration ? { duration: r.duration } : {}),
  });

  const feelingLucky = async () => {
    if (hasDraftContent && !luckyConfirm) { setLuckyConfirm(true); return; }
    setLuckyConfirm(false);
    setLuckyError('');
    setLuckyLoading(true);
    try {
      applySample(await api.randomSample());
    } catch (err) {
      setLuckyError(err instanceof Error ? err.message : String(err));
    } finally {
      setLuckyLoading(false);
    }
  };

  return (
    <>
      <div className="generate-row">
        <button
          className={luckyLoading ? 'lucky-btn loading' : 'lucky-btn'}
          disabled={luckyLoading || busy}
          onClick={feelingLucky}
        >
          {luckyLoading ? 'ROLLING…' : luckyConfirm ? 'OVERWRITE? CONFIRM' : 'FEELING LUCKY'}
        </button>
        <motion.button
          className="acid"
          animate={submitting ? {
            skewX: 0, backgroundColor: 'transparent', color: '#D4FF00',
          } : {
            skewX: -10, backgroundColor: '#D4FF00', color: '#1C1D21',
          }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          style={{ position: 'relative', overflow: 'hidden' }}
          disabled={busy || !prompt || thinking}
          onClick={generate}
        >
          {submitting ? (
            <>
              <AIGeneratingBackground />
              <span style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                STARTING…
              </span>
            </>
          ) : genJob ? 'A GENERATION IS ALREADY RUNNING' : 'GENERATE'}
        </motion.button>
      </div>
      <ActiveAdapterNote />
      {luckyConfirm && <div className="hint">This will overwrite your current prompt, lyrics, and song details.</div>}
      {luckyError && <div className="error">{luckyError} <button onClick={feelingLucky}>RETRY</button></div>}
      {error && <div className="error">{error} <button onClick={generate}>RETRY</button></div>}
    </>
  );
}
