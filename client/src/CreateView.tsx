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

type GenType = 'prompt' | 'audio';
type Source = 'upload' | 'library';

/** Small pill mirroring SettingsPanel's `.toggle-ai` shimmer, so a field visibly
 * carries the same AI ENHANCE treatment whether it's a toggle or a plain field. */
function AiEnhanceBadge() {
  return <span className="ai-badge">AI ENHANCE</span>;
}

interface Props {
  songs: Song[];
  initialPrompt: string;
  onBack: () => void;
  onCreated: () => void;
}

/** Dedicated Create takeover — reached from the Library create bar, per docs/design/DESIGN.md. */
export function CreateView({ songs, initialPrompt, onBack, onCreated }: Props) {
  const gen = useSettings((s) => s.gen);
  const [genType, setGenType] = useState<GenType>('prompt');
  const [source, setSource] = useState<Source>('upload');
  const [librarySearch, setLibrarySearch] = useState('');
  const [selectedSongId, setSelectedSongId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [prompt, setPrompt] = useState(initialPrompt);
  const [lyrics, setLyrics] = useState('');
  const [bpm, setBpm] = useState(0); // 0 = AUTO
  const [keyScale, setKeyScale] = useState(''); // '' = AUTO
  const [timeSignature, setTimeSignature] = useState(''); // '' = AUTO
  const [vocalLanguage, setVocalLanguage] = useState(''); // '' = AUTO
  const [duration, setDuration] = useState(0); // 0 = AUTO (seconds)
  const [job, setJob] = useState<'idle' | 'running' | 'failed'>('idle');
  const [stage, setStage] = useState<'loading' | 'running'>('running');
  const [error, setError] = useState('');
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

          <div className="generate-row">
            {genType === 'prompt' && (
              <button
                className={luckyLoading ? 'lucky-btn loading' : 'lucky-btn'}
                disabled={luckyLoading || job === 'running'}
                onClick={feelingLucky}
              >
                {luckyLoading ? 'ROLLING…' : luckyConfirm ? 'OVERWRITE? CONFIRM' : 'FEELING LUCKY'}
              </button>
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
          </div>
          {luckyConfirm && <div className="hint">This will overwrite your current prompt, lyrics, and song details.</div>}
          {luckyError && <div className="error">{luckyError} <button onClick={feelingLucky}>RETRY</button></div>}
          {genType === 'audio' && (
            <div className="hint">Cover generation from an uploaded or library source isn't wired to the backend yet — scoped as a follow-up.</div>
          )}
          {error && <div className="error">{error} <button onClick={generate}>RETRY</button></div>}
        </ScrollArea>
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
