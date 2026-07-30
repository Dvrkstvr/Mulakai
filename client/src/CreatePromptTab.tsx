import { useEffect, useState } from 'react';
import { type RefineResult } from './api';
import { CustomSelect } from './CustomSelect';
import { Slider } from './Slider';
import { SongDetailsFields } from './SongDetailsFields';
import { TIME_SIGNATURES, VOCAL_LANGUAGES } from './songMeta';
import { useSettings } from './settings';
import { AutoTextarea } from './AutoTextarea';
import { useThinkingQuery } from './useThinkingQuery';
import { ThinkingWipe } from './ThinkingWipe';
import { typewrite } from './typewriter';
import { AiEnhanceBadge } from './Toggle';
import { LyricTagGuidePopover } from './LyricTagGuidePopover';
import { useCreateDraftStore } from './createDraftStore';
import { CarriedPromptNote } from './CarriedPromptNote';
import { PromptGenerateRow } from './PromptGenerateRow';

/** PROMPT tab: a plain text2music generation. Extracted from CreateView.tsx, which had grown
 * past the module cap holding both this form and the screen's shell. Owns the Quick Start
 * "AI thinking" reveal, since a pending create-bar query only ever expands into this tab. */
export function CreatePromptTab({ refining, onRefine, onBack }: {
  refining: boolean;
  onRefine: () => void;
  onBack: () => void;
}) {
  const gen = useSettings((s) => s.gen);
  const { prompt, lyrics, bpm, keyScale, timeSignature, vocalLanguage, duration, formatted, pendingQuery } =
    useCreateDraftStore();
  const patch = useCreateDraftStore((s) => s.patch);
  const clearPendingQuery = useCreateDraftStore((s) => s.clearPendingQuery);

  const [pendingResult, setPendingResult] = useState<RefineResult | null>(null);
  const { phase: thinkPhase, error: thinkError, retry: retryThink, finish: finishThink } =
    useThinkingQuery(pendingQuery, setPendingResult);

  useEffect(() => {
    if (thinkPhase !== 'revealing' || !pendingResult) return;
    patch({
      formatted: true,
      ...(pendingResult.bpm ? { bpm: pendingResult.bpm } : {}),
      ...(pendingResult.key_scale ? { keyScale: pendingResult.key_scale } : {}),
      ...(pendingResult.time_signature ? { timeSignature: pendingResult.time_signature } : {}),
      ...(pendingResult.vocal_language ? { vocalLanguage: pendingResult.vocal_language } : {}),
      ...(pendingResult.duration ? { duration: pendingResult.duration } : {}),
    });
    const stopPrompt = typewrite(pendingResult.caption, (v) => patch({ prompt: v }), 700);
    const stopLyrics = typewrite(pendingResult.lyrics, (v) => patch({ lyrics: v }), 900);
    return () => { stopPrompt(); stopLyrics(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thinkPhase, pendingResult]);

  // Retiring the query once its reveal has landed keeps a tab switch (or leaving and
  // re-entering Create) from re-running the same expansion on this component's next mount.
  const finishReveal = () => { finishThink(); clearPendingQuery(); };

  return (
    <>
      <div className="thinking-host">
        <div className="field-label-row">
          <span className="section-label">PROMPT</span>
          {gen.useFormat && !formatted && <AiEnhanceBadge />}
        </div>
        <AutoTextarea
          placeholder="Describe it — style, mood, instruments"
          value={prompt}
          onChange={(v) => patch({ prompt: v, formatted: false })}
          disabled={thinkPhase !== 'idle'}
        />
        <CarriedPromptNote />
        <div className="lm-note">
          {!gen.useFormat
            ? 'AI ENHANCE is off — AUTO song details below are left for the model to decide, with no LM enhancement.'
            : formatted
              ? 'AI ENHANCE is on, but this draft is already LM-formatted — it will generate as-is, unformatted, to avoid re-enhancing it.'
              : 'AI ENHANCE is on — prompt, lyrics, and any AUTO song details below are refined and filled in by the LM.'}
        </div>

        <div className="field-label-row">
          <span className="section-label">LYRICS</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {gen.useFormat && !formatted && <AiEnhanceBadge />}
            <LyricTagGuidePopover />
          </div>
        </div>
        <AutoTextarea
          className="lyrics-input"
          placeholder="[verse]&#10;Lyrics (optional)"
          value={lyrics}
          onChange={(v) => patch({ lyrics: v, formatted: false })}
          disabled={thinkPhase !== 'idle'}
        />
        <ThinkingWipe phase={thinkPhase} onSwept={finishReveal} />
      </div>
      {thinkError && <div className="error">{thinkError} <button onClick={retryThink}>RETRY</button></div>}

      <div className="refine-row">
        <button
          className={refining ? 'refine-btn loading' : 'refine-btn'}
          disabled={!prompt || refining || thinkPhase !== 'idle'}
          onClick={onRefine}
        >
          {refining ? 'REFINING…' : 'REFINE INPUT'}
        </button>
        <span className="hint">Uses the LM to rewrite prompt &amp; lyrics and suggest AUTO song details below.</span>
      </div>

      <div className="section-label">SONG DETAILS</div>
      <div className="song-details-grid">
        <SongDetailsFields
          bpm={bpm} onBpmChange={(v) => patch({ bpm: v })}
          duration={duration} onDurationChange={(v) => patch({ duration: v })}
          keyScale={keyScale} onKeyScaleChange={(v) => patch({ keyScale: v })}
        />
        <CustomSelect label="TIME SIGNATURE" value={timeSignature} onChange={(v) => patch({ timeSignature: v })} options={TIME_SIGNATURES} />
        <CustomSelect label="VOCAL LANGUAGE" value={vocalLanguage} onChange={(v) => patch({ vocalLanguage: v })} options={VOCAL_LANGUAGES} />
        <Slider label="TAKES" value={gen.batchSize} min={0} max={4} step={1}
          readout={gen.batchSize === 0 ? 'AUTO (2)' : undefined}
          onChange={(v) => useSettings.getState().setGen({ batchSize: v })}
          info="Generates N candidates per request. Only one is currently kept — the rest are discarded." />
      </div>

      <PromptGenerateRow thinking={thinkPhase !== 'idle'} onBack={onBack} />
    </>
  );
}
