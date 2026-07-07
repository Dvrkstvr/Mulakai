import { useMemo, useRef, useState } from 'react';
import { api, type Song, type RefineResult } from './api';
import { SettingsPanel } from './SettingsPanel';
import { CustomSelect } from './CustomSelect';
import { Slider } from './Slider';
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

/** Small pill mirroring SettingsPanel's `.toggle-ai` shimmer, so a field visibly
 * carries the same AI ENHANCE treatment whether it's a toggle or a plain field. */
function AiEnhanceBadge() {
  return <span className="ai-badge">AI ENHANCE</span>;
}

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
  const [queryText, setQueryText] = useState('');
  const [queryLoading, setQueryLoading] = useState(false);
  const [queryConfirm, setQueryConfirm] = useState(false);
  const [queryError, setQueryError] = useState('');

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
    const draft: CreateDraft = { genType, prompt, lyrics, bpm, keyScale, timeSignature, duration };
    try {
      await startGeneration(
        { title: title || 'Untitled', prompt, lyrics, ...metaParams(), ...genParams(gen), ...voiceParams(voice) },
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

  const runQuery = async () => {
    if (!queryText) return;
    if (hasDraftContent && !queryConfirm) { setQueryConfirm(true); return; }
    setQueryConfirm(false);
    setQueryError('');
    setQueryLoading(true);
    try {
      applySample(await api.sampleFromQuery(queryText));
    } catch (err) {
      setQueryError(err instanceof Error ? err.message : String(err));
    } finally {
      setQueryLoading(false);
    }
  };

  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;
  const headerLeft = useMemo(() => <button onClick={() => onBackRef.current()}>&#8592; LIBRARY</button>, []);
  useHeaderSlot(headerLeft, null);

  const showRail = refining || !!refinePreview || !!refineError;
  const referenceAudioTaskType = genType === 'audio' ? 'cover' : genType === 'complete' ? 'complete' : 'text2music';

  return (
    <div className="create-shell">
      <div className={showRail ? 'with-panel create-layout with-rail' : 'with-panel create-layout'}>
        <SettingsPanel mode="generate" hideLmControls={genType === 'audio'} referenceAudioTaskType={referenceAudioTaskType} />
        <div className="create-panel">
          <ScrollArea className="create-content">
            <div className="section-label">GENERATION TYPE</div>
            <div className="type-tabs">
              <button className={genType === 'prompt' ? 'tab active' : 'tab'} onClick={() => setGenType('prompt')}><span>PROMPT</span></button>
              <button className={genType === 'audio' ? 'tab active' : 'tab'} onClick={() => setGenType('audio')}><span>COVER</span></button>
              <button className={genType === 'complete' ? 'tab active' : 'tab'} onClick={() => setGenType('complete')}><span>ARRANGE</span></button>
            </div>

            <input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />

            {genType === 'audio' && <CreateAudioTab songs={songs} title={title} initialDraft={initialDraft} onBack={onBack} />}
            {genType === 'complete' && <CreateArrangeTab title={title} onBack={onBack} />}

            {genType === 'prompt' && (
              <>
                <div className="section-label">QUICK START</div>
                <div className="query-row">
                  <input
                    placeholder="Describe your song — e.g. sad indie rock ballad with reverb"
                    value={queryText}
                    onChange={(e) => { setQueryText(e.target.value); setQueryConfirm(false); }}
                  />
                  <button
                    className={queryLoading ? 'lucky-btn loading' : 'lucky-btn'}
                    disabled={!queryText || queryLoading}
                    onClick={runQuery}
                  >
                    {queryLoading ? 'GENERATING…' : queryConfirm ? 'OVERWRITE? CONFIRM' : 'GENERATE DETAILS'}
                  </button>
                </div>
                {queryConfirm && <div className="hint">This will overwrite your current prompt, lyrics, and song details.</div>}
                {queryError && <div className="error">{queryError} <button onClick={runQuery}>RETRY</button></div>}

                <div className="field-label-row">
                  <span className="section-label">PROMPT</span>
                  {gen.useFormat && <AiEnhanceBadge />}
                </div>
                <input placeholder="Describe it — style, mood, instruments" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
                <div className="lm-note">
                  {gen.useFormat
                    ? 'AI ENHANCE is on — prompt, lyrics, and any AUTO song details below are refined and filled in by the LM.'
                    : 'AI ENHANCE is off — AUTO song details below are left for the model to decide, with no LM enhancement.'}
                </div>

                <div className="field-label-row">
                  <span className="section-label">LYRICS</span>
                  {gen.useFormat && <AiEnhanceBadge />}
                </div>
                <textarea placeholder="[verse]&#10;Lyrics (optional)" value={lyrics} onChange={(e) => setLyrics(e.target.value)} />

                <div className="refine-row">
                  <button
                    className={refining ? 'refine-btn loading' : 'refine-btn'}
                    disabled={!prompt || refining}
                    onClick={refine}
                  >
                    {refining ? 'REFINING…' : 'REFINE INPUT'}
                  </button>
                  <span className="hint">Uses the LM to rewrite prompt &amp; lyrics and suggest AUTO song details below.</span>
                </div>

                <div className="section-label">SONG DETAILS</div>
                <div className="song-details-grid">
                  <Slider label="BPM" value={bpm} min={0} max={300} step={1}
                    readout={bpm === 0 ? 'AUTO' : undefined} onChange={setBpm} />
                  <Slider label="DURATION" value={duration} min={0} max={600} step={5}
                    readout={duration === 0 ? 'AUTO' : `${duration}s`} onChange={setDuration} />
                  <div className="setting">
                    <div className="setting-head"><span>KEY / SCALE</span></div>
                    <input placeholder="AUTO (e.g. C Major, Am)" value={keyScale} onChange={(e) => setKeyScale(e.target.value)} />
                  </div>
                  <CustomSelect label="TIME SIGNATURE" value={timeSignature} onChange={setTimeSignature} options={TIME_SIGNATURES} />
                  <CustomSelect label="VOCAL LANGUAGE" value={vocalLanguage} onChange={setVocalLanguage} options={VOCAL_LANGUAGES} />
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
                    disabled={generationBusy || !prompt}
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
          <RefineRail
            refining={refining}
            preview={refinePreview}
            error={refineError}
            current={{ prompt, lyrics, bpm, keyScale, timeSignature, vocalLanguage, duration }}
            onRefine={refine}
            onClose={closeRefine}
            onAccept={{
              prompt: setPrompt,
              lyrics: setLyrics,
              bpm: setBpm,
              keyScale: setKeyScale,
              timeSignature: setTimeSignature,
              vocalLanguage: setVocalLanguage,
              duration: setDuration,
            }}
          />
        )}
      </div>
    </div>
  );
}
