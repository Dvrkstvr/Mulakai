import { useMemo, useRef, useState } from 'react';
import { api, type Song, type RefineResult } from './api';
import { SettingsPanel } from './SettingsPanel';
import { CustomSelect } from './CustomSelect';
import { Slider } from './Slider';
import { RefineRail } from './RefineRail';
import { TIME_SIGNATURES, VOCAL_LANGUAGES } from './songMeta';
import { useSettings, genParams } from './settings';
import { motion } from 'framer-motion';
import { AIGeneratingBackground } from './AIGeneratingBackground';
import { useHeaderSlot } from './HeaderSlot';
import { ScrollArea } from './ScrollArea';
import type { CreateDraft } from './createDraft';

/** Small pill mirroring SettingsPanel's `.toggle-ai` shimmer, so a field visibly
 * carries the same AI ENHANCE treatment whether it's a toggle or a plain field. */
function AiEnhanceBadge() {
  return <span className="ai-badge">AI ENHANCE</span>;
}

interface Props {
  songs: Song[];
  initialDraft: CreateDraft;
  onBack: () => void;
  onCreated: () => void;
}

/** Dedicated Create takeover — reached from the Library create bar or the Library
 * detail rail's REUSE PROMPT / CREATE COVER FROM AUDIO actions (`initialDraft`),
 * per docs/design/DESIGN.md. */
export function CreateView({ songs, initialDraft, onBack, onCreated }: Props) {
  const gen = useSettings((s) => s.gen);
  const [genType, setGenType] = useState(initialDraft.genType ?? 'prompt');
  const [source, setSource] = useState(initialDraft.source ?? 'upload');
  const [librarySearch, setLibrarySearch] = useState('');
  const [selectedSongId, setSelectedSongId] = useState<string | null>(initialDraft.selectedSongId ?? null);
  const [title, setTitle] = useState('');
  const [prompt, setPrompt] = useState(initialDraft.prompt ?? '');
  const [lyrics, setLyrics] = useState(initialDraft.lyrics ?? '');
  const [bpm, setBpm] = useState(initialDraft.bpm ?? 0); // 0 = AUTO
  const [keyScale, setKeyScale] = useState(initialDraft.keyScale ?? ''); // '' = AUTO
  const [timeSignature, setTimeSignature] = useState(initialDraft.timeSignature ?? ''); // '' = AUTO
  const [vocalLanguage, setVocalLanguage] = useState(''); // '' = AUTO
  const [duration, setDuration] = useState(initialDraft.duration ?? 0); // 0 = AUTO (seconds)
  const [job, setJob] = useState<'idle' | 'running' | 'failed'>('idle');
  const [stage, setStage] = useState<'loading' | 'running'>('running');
  const [error, setError] = useState('');
  const [refining, setRefining] = useState(false);
  const [refinePreview, setRefinePreview] = useState<RefineResult | null>(null);
  const [refineError, setRefineError] = useState('');

  const metaParams = () => ({
    ...(bpm > 0 ? { bpm } : {}),
    ...(keyScale ? { key_scale: keyScale } : {}),
    ...(timeSignature ? { time_signature: timeSignature } : {}),
    ...(vocalLanguage ? { vocal_language: vocalLanguage } : {}),
    ...(duration > 0 ? { audio_duration: duration } : {}),
  });

  const generate = async () => {
    setError('');
    setJob('running');
    setStage('loading');
    try {
      const { jobId } = await api.generate({ title: title || 'Untitled', prompt, lyrics, ...metaParams(), ...genParams(gen) });
      for (;;) {
        await new Promise((r) => setTimeout(r, 2000));
        const s = await api.jobStatus(jobId);
        if (s.status === 'loading' || s.status === 'running') setStage(s.status);
        if (s.status === 'done') { setJob('idle'); onCreated(); return; }
        if (s.status === 'failed') throw new Error(s.error ?? 'generation failed');
      }
    } catch (err) {
      setJob('failed');
      setError(err instanceof Error ? err.message : String(err));
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

  const visibleLibrary = songs.filter((s) => s.title.toLowerCase().includes(librarySearch.toLowerCase()));

  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;
  const headerLeft = useMemo(() => <button onClick={() => onBackRef.current()}>&#8592; LIBRARY</button>, []);
  useHeaderSlot(headerLeft, null);

  const showRail = refining || !!refinePreview || !!refineError;

  return (
    <div className="create-shell">
      <div className={showRail ? 'with-panel create-layout with-rail' : 'with-panel create-layout'}>
        <SettingsPanel mode="generate" hideLmControls={genType === 'audio'} />
        <div className="create-panel">
        <ScrollArea className="create-content">
          <div className="title-row">
            <span className="song-title">New song</span>
            <span className="meta">
              {genType === 'prompt' ? 'will appear in your library once generated' : 'will generate a new song using this audio as reference'}
            </span>
          </div>
          <div className="section-label">GENERATION TYPE</div>
          <div className="type-tabs">
            <button className={genType === 'prompt' ? 'tab active' : 'tab'} onClick={() => setGenType('prompt')}><span>PROMPT</span></button>
            <button className={genType === 'audio' ? 'tab active' : 'tab'} onClick={() => setGenType('audio')}><span>AUDIO</span></button>
          </div>

          <input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />

          {genType === 'audio' && (
            <>
              <div className="section-label">SOURCE</div>
              <div className="type-tabs">
                <button className={source === 'upload' ? 'tab active' : 'tab'} onClick={() => setSource('upload')}><span>UPLOAD</span></button>
                <button className={source === 'library' ? 'tab active' : 'tab'} onClick={() => setSource('library')}><span>FROM LIBRARY</span></button>
              </div>
              {source === 'upload' ? (
                <label className="dropzone">
                  <input type="file" accept="audio/*" style={{ display: 'none' }} />
                  drag audio file here or click to browse
                </label>
              ) : (
                <div className="song-picker">
                  <input placeholder="Search your library…" value={librarySearch} onChange={(e) => setLibrarySearch(e.target.value)} />
                  <div className="song-picker-list">
                    {visibleLibrary.map((s) => (
                      <div
                        key={s.id}
                        className={s.id === selectedSongId ? 'song-pick current' : 'song-pick'}
                        onClick={() => setSelectedSongId(s.id)}
                      >
                        {s.title}
                      </div>
                    ))}
                    {visibleLibrary.length === 0 && <div className="empty">No songs match.</div>}
                  </div>
                </div>
              )}
            </>
          )}

          {genType === 'prompt' && (
            <div className="field-label-row">
              <span className="section-label">PROMPT</span>
              {gen.useFormat && <AiEnhanceBadge />}
            </div>
          )}
          <input
            placeholder={genType === 'audio' ? 'Describe the change — style, mood, instruments' : 'Describe it — style, mood, instruments'}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
          {genType === 'prompt' && (
            <div className="lm-note">
              {gen.useFormat
                ? 'AI ENHANCE is on — prompt, lyrics, and any AUTO song details below are refined and filled in by the LM.'
                : 'AI ENHANCE is off — AUTO song details below are left for the model to decide, with no LM enhancement.'}
            </div>
          )}

          {genType === 'prompt' && (
            <>
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
            </>
          )}

          <motion.button
            className="acid"
            animate={job === 'running' ? {
              skewX: 0, backgroundColor: 'transparent', color: '#D4FF00',
            } : {
              skewX: -10, backgroundColor: '#D4FF00', color: '#1C1D21',
            }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            style={{ position: 'relative', overflow: 'hidden' }}
            disabled={genType === 'audio' || job === 'running' || !prompt}
            onClick={generate}
          >
            {job === 'running' ? (
              <>
                <AIGeneratingBackground />
                <span style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                  {stage === 'loading' ? 'LOADING MODEL…' : 'GENERATING…'}
                </span>
              </>
            ) : genType === 'audio' ? 'AUDIO GENERATION — COMING SOON' : 'GENERATE'}
          </motion.button>
          {genType === 'audio' && (
            <div className="hint">Cover generation from an uploaded or library source isn't wired to the backend yet — scoped as a follow-up.</div>
          )}
          {error && <div className="error">{error} <button onClick={generate}>RETRY</button></div>}
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
