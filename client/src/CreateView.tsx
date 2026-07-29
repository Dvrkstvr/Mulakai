import { useEffect, useMemo, useRef, useState } from 'react';
import { api, type Song, type RefineResult } from './api';
import { SettingsPanel } from './SettingsPanel';
import { CustomSelect } from './CustomSelect';
import { Slider } from './Slider';
import { SongDetailsFields } from './SongDetailsFields';
import { RefineRail } from './RefineRail';
import { TIME_SIGNATURES, VOCAL_LANGUAGES } from './songMeta';
import { useSettings, genParams } from './settings';
import { useVoiceStore, voiceParams } from './voiceStore';
import { motion } from 'framer-motion';
import { AIGeneratingBackground } from './AIGeneratingBackground';
import { useHeaderSlot } from './HeaderSlot';
import { ScrollArea } from './ScrollArea';
import type { CreateDraft } from './createDraft';
import { useGenerationStore } from './generationStore';
import { CreateAudioTab } from './CreateAudioTab';
import { CreateArrangeTab } from './CreateArrangeTab';
import { AutoTextarea } from './AutoTextarea';
import { useThinkingQuery } from './useThinkingQuery';
import { ThinkingWipe } from './ThinkingWipe';
import { typewrite } from './typewriter';
import { useResizableWidth } from './useResizableWidth';
import { ResizeHandle } from './ResizeHandle';
import { AiEnhanceBadge } from './Toggle';
import { LyricTagGuidePopover } from './LyricTagGuidePopover';

interface Props {
  songs: Song[];
  initialDraft: CreateDraft;
  onBack: () => void;
}

/** Dedicated Create takeover — reached from the Library create bar or the Library
 * detail rail's REUSE PROMPT / CREATE COVER FROM AUDIO actions (`initialDraft`),
 * per docs/design/DESIGN.md. Submitting a generation hands it off to
 * generationStore.ts and returns to the library immediately — the library's
 * GeneratingCard tracks it to completion from there, so only one generation can
 * ever be in flight globally. Owns the PROMPT (text2music) tab directly; the
 * AUDIO (cover) and ARRANGE (complete) tabs are self-contained components —
 * CreateAudioTab.tsx / CreateArrangeTab.tsx — since each has its own source/
 * model state that shouldn't leak into the others. */
export function CreateView({ songs, initialDraft, onBack }: Props) {
  const gen = useSettings((s) => s.gen);
  const voice = useVoiceStore();
  const [genType, setGenType] = useState(initialDraft.genType ?? 'prompt');
  const [title, setTitle] = useState('');
  const folderId = initialDraft.folderId;
  const folderName = initialDraft.folderName;
  const [prompt, setPrompt] = useState(initialDraft.prompt ?? '');
  const [lyrics, setLyrics] = useState(initialDraft.lyrics ?? '');
  const [bpm, setBpm] = useState(initialDraft.bpm ?? 0); // 0 = AUTO
  const [keyScale, setKeyScale] = useState(initialDraft.keyScale ?? ''); // '' = AUTO
  const [timeSignature, setTimeSignature] = useState(initialDraft.timeSignature ?? ''); // '' = AUTO
  const [vocalLanguage, setVocalLanguage] = useState(''); // '' = AUTO
  const [duration, setDuration] = useState(initialDraft.duration ?? 0); // 0 = AUTO (seconds)
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const genJob = useGenerationStore((s) => s.job);
  const startGeneration = useGenerationStore((s) => s.start);
  const dismissGeneration = useGenerationStore((s) => s.dismiss);
  const generationBusy = submitting || !!genJob;
  const [refining, setRefining] = useState(false);
  const [refinePreview, setRefinePreview] = useState<RefineResult | null>(null);
  const [refineError, setRefineError] = useState('');
  const [luckyLoading, setLuckyLoading] = useState(false);
  const [luckyConfirm, setLuckyConfirm] = useState(false);
  const [luckyError, setLuckyError] = useState('');
  /** True once prompt/lyrics came from the LM (feeling lucky, refine accept, or the
   * Quick Start reveal) — AI ENHANCE re-formatting already-formatted text is what
   * produced ACE-Step's LM decoding-artifact garbage, so generate() suppresses
   * use_format for this draft until the user edits prompt/lyrics by hand again. */
  const [formatted, setFormatted] = useState(false);

  const [pendingResult, setPendingResult] = useState<RefineResult | null>(null);
  const { phase: thinkPhase, error: thinkError, retry: retryThink, finish: finishThink } =
    useThinkingQuery(initialDraft.pendingQuery, setPendingResult);

  // Prefills Title with "<Folder Name>" (or "<Folder Name> <n>" past the highest number
  // already used there) when Create was opened from/for a specific folder — still a plain
  // editable value, not a locked default. Skipped if the field already has content (e.g. a
  // RETRY draft) so it never clobbers something the user or a retry already put there.
  useEffect(() => {
    if (!folderId || title) return;
    api.nextFolderTitle(folderId).then((r) => setTitle(r.title)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folderId]);

  useEffect(() => {
    if (thinkPhase !== 'revealing' || !pendingResult) return;
    if (pendingResult.bpm) setBpm(pendingResult.bpm);
    if (pendingResult.key_scale) setKeyScale(pendingResult.key_scale);
    if (pendingResult.time_signature) setTimeSignature(pendingResult.time_signature);
    if (pendingResult.vocal_language) setVocalLanguage(pendingResult.vocal_language);
    if (pendingResult.duration) setDuration(pendingResult.duration);
    setFormatted(true);
    const stopPrompt = typewrite(pendingResult.caption, setPrompt, 700);
    const stopLyrics = typewrite(pendingResult.lyrics, setLyrics, 900);
    return () => { stopPrompt(); stopLyrics(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thinkPhase, pendingResult]);

  const metaParams = () => ({
    ...(bpm > 0 ? { bpm } : {}),
    ...(keyScale ? { key_scale: keyScale } : {}),
    ...(timeSignature ? { time_signature: timeSignature } : {}),
    ...(vocalLanguage ? { vocal_language: vocalLanguage } : {}),
    ...(duration > 0 ? { audio_duration: duration } : {}),
  });

  const generate = async () => {
    setError('');
    setSubmitting(true);
    const draft: CreateDraft = {
      genType, prompt, lyrics, bpm, keyScale, timeSignature, duration,
      ...(folderId ? { folderId, folderName } : {}),
    };
    // AI ENHANCE re-formats whatever prompt/lyrics it's given — fine for hand-typed
    // text, but re-running it on text the LM already produced is what garbled the
    // sung output (see jobs.ts persistSong). Suppress it for this one generation
    // rather than flipping the persisted setting, so it's back next time you type.
    const effectiveGen = formatted ? { ...gen, useFormat: false } : gen;
    try {
      await startGeneration(
        {
          title: title || 'Untitled', prompt, lyrics, ...metaParams(), ...genParams(effectiveGen), ...voiceParams(voice),
          ...(folderId ? { folder_id: folderId } : {}),
        },
        draft,
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

  const refine = async () => {
    setRefineError('');
    setRefining(true);
    try {
      setRefinePreview(await api.refineInput({ prompt, lyrics, ...metaParams() }));
    } catch (err) {
      setRefineError(err instanceof Error ? err.message : String(err));
    } finally {
      setRefining(false);
    }
  };

  const closeRefine = () => {
    setRefinePreview(null);
    setRefineError('');
  };

  const hasDraftContent = !!(prompt || lyrics || bpm || keyScale || timeSignature || vocalLanguage || duration);

  const applySample = (r: RefineResult) => {
    setFormatted(true);
    setPrompt(r.caption);
    setLyrics(r.lyrics);
    if (r.bpm) setBpm(r.bpm);
    if (r.key_scale) setKeyScale(r.key_scale);
    if (r.time_signature) setTimeSignature(r.time_signature);
    if (r.vocal_language) setVocalLanguage(r.vocal_language);
    if (r.duration) setDuration(r.duration);
  };

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

  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;
  const headerLeft = useMemo(() => <button onClick={() => onBackRef.current()}>&#8592; LIBRARY</button>, []);
  useHeaderSlot(headerLeft, null);

  const showRail = refining || !!refinePreview || !!refineError;
  const referenceAudioTaskType = genType === 'audio' ? 'cover' : genType === 'complete' ? 'complete' : 'text2music';

  const settingsWidth = useResizableWidth({ storageKey: 'mulakai:createSettingsWidth', default: 210, min: 180, max: 420, growsToward: 'right' });
  const railWidth = useResizableWidth({ storageKey: 'mulakai:createRailWidth', default: 300, min: 240, max: 520, growsToward: 'left' });
  const gridTemplateColumns = `${settingsWidth.width}px 1fr${showRail ? ` ${railWidth.width}px` : ''}`;

  return (
    <div className="create-shell">
      <div className={showRail ? 'with-panel create-layout with-rail' : 'with-panel create-layout'} style={{ gridTemplateColumns }}>
        <div className="resizable-col">
          <SettingsPanel mode="generate" hideLmControls={genType === 'audio'} referenceAudioTaskType={referenceAudioTaskType} />
          <ResizeHandle side="right" onPointerDown={settingsWidth.onPointerDown} />
        </div>
        <div className="create-panel">
          <ScrollArea className="create-content">
            <div className="section-label">GENERATION TYPE</div>
            <div className="type-tabs">
              <button className={genType === 'prompt' ? 'tab active' : 'tab'} onClick={() => setGenType('prompt')}><span>PROMPT</span></button>
              <button className={genType === 'audio' ? 'tab active' : 'tab'} onClick={() => setGenType('audio')}><span>COVER</span></button>
              <button className={genType === 'complete' ? 'tab active' : 'tab'} onClick={() => setGenType('complete')}><span>ARRANGE</span></button>
            </div>

            {folderName && (
              <div className="folder-dest">
                <span className="section-label">Save To</span>
                <span className="dest-chip"><span className="lbl">&#9656; {folderName}</span></span>
              </div>
            )}

            <AutoTextarea placeholder="Title" value={title} onChange={setTitle} />

            {genType === 'audio' && <CreateAudioTab songs={songs} title={title} folderId={folderId} initialDraft={initialDraft} onBack={onBack} />}
            {genType === 'complete' && <CreateArrangeTab title={title} folderId={folderId} initialDraft={initialDraft} onBack={onBack} />}

            {genType === 'prompt' && (
              <>
                <div className="thinking-host">
                  <div className="field-label-row">
                    <span className="section-label">PROMPT</span>
                    {gen.useFormat && !formatted && <AiEnhanceBadge />}
                  </div>
                  <AutoTextarea
                    placeholder="Describe it — style, mood, instruments"
                    value={prompt}
                    onChange={(v) => { setPrompt(v); setFormatted(false); }}
                    disabled={thinkPhase !== 'idle'}
                  />
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
                    onChange={(v) => { setLyrics(v); setFormatted(false); }}
                    disabled={thinkPhase !== 'idle'}
                  />
                  <ThinkingWipe phase={thinkPhase} onSwept={finishThink} />
                </div>
                {thinkError && <div className="error">{thinkError} <button onClick={retryThink}>RETRY</button></div>}

                <div className="refine-row">
                  <button
                    className={refining ? 'refine-btn loading' : 'refine-btn'}
                    disabled={!prompt || refining || thinkPhase !== 'idle'}
                    onClick={refine}
                  >
                    {refining ? 'REFINING…' : 'REFINE INPUT'}
                  </button>
                  <span className="hint">Uses the LM to rewrite prompt &amp; lyrics and suggest AUTO song details below.</span>
                </div>

                <div className="section-label">SONG DETAILS</div>
                <div className="song-details-grid">
                  <SongDetailsFields
                    bpm={bpm} onBpmChange={setBpm}
                    duration={duration} onDurationChange={setDuration}
                    keyScale={keyScale} onKeyScaleChange={setKeyScale}
                  />
                  <CustomSelect label="TIME SIGNATURE" value={timeSignature} onChange={setTimeSignature} options={TIME_SIGNATURES} />
                  <CustomSelect label="VOCAL LANGUAGE" value={vocalLanguage} onChange={setVocalLanguage} options={VOCAL_LANGUAGES} />
                  <Slider label="TAKES" value={gen.batchSize} min={0} max={4} step={1}
                    readout={gen.batchSize === 0 ? 'AUTO (2)' : undefined}
                    onChange={(v) => useSettings.getState().setGen({ batchSize: v })}
                    info="Generates N candidates per request. Only one is currently kept — the rest are discarded." />
                </div>

                <div className="generate-row">
                  <button
                    className={luckyLoading ? 'lucky-btn loading' : 'lucky-btn'}
                    disabled={luckyLoading || generationBusy}
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
                    disabled={generationBusy || !prompt || thinkPhase !== 'idle'}
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
                {luckyConfirm && <div className="hint">This will overwrite your current prompt, lyrics, and song details.</div>}
                {luckyError && <div className="error">{luckyError} <button onClick={feelingLucky}>RETRY</button></div>}
                {error && <div className="error">{error} <button onClick={generate}>RETRY</button></div>}
              </>
            )}
          </ScrollArea>
        </div>
        {showRail && (
          <div className="resizable-col">
            <ResizeHandle side="left" onPointerDown={railWidth.onPointerDown} />
            <RefineRail
              refining={refining}
              preview={refinePreview}
              error={refineError}
              current={{ prompt, lyrics, bpm, keyScale, timeSignature, vocalLanguage, duration }}
              onRefine={refine}
              onClose={closeRefine}
              onAccept={{
                prompt: (v) => { setPrompt(v); setFormatted(true); },
                lyrics: (v) => { setLyrics(v); setFormatted(true); },
                bpm: setBpm,
                keyScale: setKeyScale,
                timeSignature: setTimeSignature,
                vocalLanguage: setVocalLanguage,
                duration: setDuration,
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
