import { useEffect, useState, type ReactNode } from 'react';
import type { ModelInventory, RefineResult } from './api';
import { useSettings } from './settings';
import { AutoTextarea } from './AutoTextarea';
import { useThinkingQuery } from './useThinkingQuery';
import { ThinkingWipe } from './ThinkingWipe';
import { typewrite } from './typewriter';
import { AiEnhanceBadge } from './Toggle';
import { LyricTagGuidePopover } from './LyricTagGuidePopover';
import { useCreateDraftStore } from './createDraftStore';
import { CarriedPromptNote } from './CarriedPromptNote';
import { PromptEngineChoice } from './EngineChoice';
import { useEngineCaps } from './useEngineCaps';
import { instrumentalNaNote, isInstrumental, toggleInstrumental } from './instrumental';
import { unsupported } from './engineCaps';
import type { Lookup } from './lookup';
import { CreateStep } from './CreateStep';
import { IdeaLucky } from './IdeaLucky';
import { IdeaDetails } from './IdeaDetails';
import { IdeaCommit } from './IdeaCommit';
import { RecipeCard } from './RecipeCard';
import { GenTune } from './GenTune';

/** START FROM · AN IDEA (was CreatePromptTab.tsx): a text2music generation in three steps, with
 * its RECIPE beside them. Owns the Quick Start "AI thinking" reveal, since a pending create-bar
 * query only ever expands here. `rail` is the refine preview, which takes the recipe's slot. */
export function IdeaSteps({ refining, onRefine, onBack, rail, inventory }: {
  refining: boolean;
  onRefine: () => void;
  onBack: () => void;
  rail: ReactNode;
  inventory: Lookup<ModelInventory> & { retry: () => void };
}) {
  const gen = useSettings((s) => s.gen);
  const { prompt, lyrics, formatted, pendingQuery } = useCreateDraftStore();
  const patch = useCreateDraftStore((s) => s.patch);
  const clearPendingQuery = useCreateDraftStore((s) => s.clearPendingQuery);
  const { info: engine } = useEngineCaps();
  const caps = engine?.capabilities ?? null;
  // AI ENHANCE is ACE-Step's LM rewriting the request; an engine without LM tools gets the text as typed.
  const enhance = gen.useFormat && !formatted && (!caps || caps.lmTools);
  const stepsModel = gen.model || inventory.data?.defaultModel || '';
  const modelUnknownWhy = inventory.error ? "couldn't load the model list (RETRY in TUNE)"
    : !inventory.data ? 'the model list is still loading' : 'ACE-Step names no default model, so pick a DIT MODEL in TUNE';

  const [pendingResult, setPendingResult] = useState<RefineResult | null>(null);
  const { phase: thinkPhase, error: thinkError, retry: retryThink, finish: finishThink } =
    useThinkingQuery(pendingQuery, setPendingResult);
  const thinking = thinkPhase !== 'idle';

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

  // Retiring the query once its reveal has landed keeps a card switch (or leaving and
  // re-entering Create) from re-running the same expansion on this component's next mount.
  const finishReveal = () => { finishThink(); clearPendingQuery(); };
  const instrumentalNext = toggleInstrumental(lyrics);
  const instrumentalNa = unsupported('instrumental', caps);

  return (
    <>
      <div className="create-steps">
        <div className="thinking-host">
          <CreateStep n={1} title="DESCRIBE IT" actions={enhance && <AiEnhanceBadge />}>
            <AutoTextarea placeholder="Describe it — style, mood, instruments" value={prompt}
              onChange={(v) => patch({ prompt: v, formatted: false })} disabled={thinking} />
            <CarriedPromptNote />
            {caps && !caps.lmTools ? (
              <div className="hint">{engine?.label} gets prompt and lyrics as typed — AI ENHANCE is ACE-Step&apos;s LM and doesn&apos;t apply.</div>
            ) : <div className="lm-note">
              {!gen.useFormat
                ? 'AI ENHANCE is off — AUTO details below are left for the model to decide, with no LM enhancement.'
                : formatted
                  ? 'AI ENHANCE is on, but this draft is already LM-formatted — it will generate as-is, unformatted, to avoid re-enhancing it.'
                  : 'AI ENHANCE is on — prompt, lyrics, and any AUTO details below are refined and filled in by the LM.'}
            </div>}
            <div className="step-tools"><IdeaLucky disabled={thinking} /></div>
          </CreateStep>
          <CreateStep n={2} title="LYRICS" actions={<>
            {enhance && <AiEnhanceBadge />}
            <button className={refining ? 'refine-btn loading' : 'refine-btn'} disabled={!prompt || refining || thinking} onClick={onRefine}>
              {refining ? 'WRITING…' : 'WRITE FOR ME'}
            </button>
            <LyricTagGuidePopover />
            <button type="button" className={isInstrumental(lyrics) && !instrumentalNa ? 'tag-guide-btn on' : 'tag-guide-btn'}
              aria-pressed={isInstrumental(lyrics) && !instrumentalNa} disabled={instrumentalNa || instrumentalNext === null || thinking}
              title={!instrumentalNa && instrumentalNext === null ? 'clear the lyrics first — INSTRUMENTAL never replaces your words' : undefined}
              onClick={() => instrumentalNext !== null && patch({ lyrics: instrumentalNext, formatted: false })}>
              <span>INSTRUMENTAL</span>
            </button>
          </>}>
            <AutoTextarea className="lyrics-input" placeholder="[verse]&#10;Lyrics (optional)" value={lyrics}
              onChange={(v) => patch({ lyrics: v, formatted: false })} disabled={thinking} />
            {instrumentalNa && <div className="hint">{instrumentalNaNote(engine?.label ?? '', lyrics)}</div>}
            <div className="hint">WRITE FOR ME uses the LM to rewrite prompt &amp; lyrics and suggest AUTO details · you accept each one in the preview</div>
          </CreateStep>
          <ThinkingWipe phase={thinkPhase} onSwept={finishReveal} />
        </div>
        {thinkError && <div className="error">{thinkError} <button onClick={retryThink}>RETRY</button></div>}
        <CreateStep n={3} optional title="DETAILS" sub="optional · AUTO lets the planner decide">
          <IdeaDetails />
        </CreateStep>
      </div>
      {rail ?? (
        <RecipeCard stepsModel={stepsModel} modelUnknownWhy={modelUnknownWhy} engine={<PromptEngineChoice />}
          tune={<GenTune inventory={inventory} stepsModel={stepsModel} />}
          commit={<IdeaCommit thinking={thinking} onBack={onBack} stepsModel={stepsModel} />} />
      )}
    </>
  );
}
