import { useEffect, useState } from 'react';
import { api, type StemKind } from './api';
import { CustomSelect } from './CustomSelect';
import { AIGeneratingBackground } from './AIGeneratingBackground';
import { ScratchSplitPicker } from './ScratchSplitPicker';
import { motion } from 'framer-motion';
import type { CreateDraft } from './createDraft';
import { useGenerationStore } from './generationStore';
import { useVoiceStore } from './voiceStore';
import { useModelsForTask } from './useModelsForTask';
import { useSettings, genParams } from './settings';
import { AutoTextarea } from './AutoTextarea';
import { SongAnalysisFields } from './SongAnalysisFields';
import { useAnalyzeAndApply, type AnalyzeSource } from './useAnalyzeSourceAudio';

interface Props {
  title: string;
  folderId?: string;
  onBack: () => void;
}

type ArrangeSource = 'upload' | 'split';

/** ARRANGE tab: ACE-Step's `complete` task — build a whole accompaniment around a single
 * bare source track (as opposed to AUDIO's `cover`, which regenerates a full existing mix
 * keeping its structure, or the Editor's Add Layer `lego`, which adds one part to an
 * already-multi-layer song). Unlike AUDIO, the 5Hz LM is NOT skipped for `complete`
 * (docs/ace-step-1.5/API.md#4.2), so THINKING MODE / AI ENHANCE in the sidebar are live here —
 * see CreateView.tsx's `hideLmControls` check, which only targets the AUDIO tab. */
export function CreateArrangeTab({ title, folderId, onBack }: Props) {
  const gen = useSettings((s) => s.gen);
  const [source, setSource] = useState<ArrangeSource>('upload');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [scratchSource, setScratchSource] = useState<{ jobId: string; kind: StemKind } | null>(null);
  const [prompt, setPrompt] = useState('');
  const [lyrics, setLyrics] = useState('');
  const [bpm, setBpm] = useState(0); // 0 = AUTO
  const [keyScale, setKeyScale] = useState(''); // '' = AUTO
  const [duration, setDuration] = useState(0); // 0 = AUTO (seconds)
  const [model, setModel] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [luckyLoading, setLuckyLoading] = useState(false);
  const [luckyError, setLuckyError] = useState('');

  const arrangeModels = useModelsForTask('complete');
  useEffect(() => {
    if (arrangeModels && !model) setModel(arrangeModels.find((n) => n.includes('xl-base')) ?? arrangeModels.find((n) => n.includes('base')) ?? arrangeModels[0] ?? '');
  }, [arrangeModels, model]);

  const genJob = useGenerationStore((s) => s.job);
  const startComplete = useGenerationStore((s) => s.startComplete);
  const dismiss = useGenerationStore((s) => s.dismiss);
  const voice = useVoiceStore();
  const busy = submitting || !!genJob;

  const sourceReady = source === 'upload' ? !!uploadFile : !!scratchSource;
  const ready = sourceReady && !!model && (arrangeModels?.length ?? 0) > 0;

  const analyzeSource: AnalyzeSource = source === 'upload'
    ? (uploadFile ? { kind: 'file', key: `upload:${uploadFile.name}:${uploadFile.size}:${uploadFile.lastModified}`, resolve: async () => uploadFile } : null)
    : (scratchSource ? { kind: 'scratch', jobId: scratchSource.jobId, stemKind: scratchSource.kind } : null);
  const analysis = useAnalyzeAndApply(analyzeSource, prompt, lyrics, {
    setPrompt, setLyrics, setBpm, setKeyScale, setDuration,
  });

  const feelingLucky = async () => {
    setLuckyError('');
    setLuckyLoading(true);
    try {
      const sample = await api.randomSample();
      setPrompt(sample.caption);
    } catch (err) {
      setLuckyError(err instanceof Error ? err.message : String(err));
    } finally {
      setLuckyLoading(false);
    }
  };

  const generate = async () => {
    setError('');
    setSubmitting(true);
    const draft: CreateDraft = { genType: 'complete', prompt, lyrics, bpm, keyScale, duration };
    try {
      const src = source === 'upload'
        ? (uploadFile ? { file: uploadFile } : null)
        : (scratchSource ? { scratchJobId: scratchSource.jobId, scratchStemKind: scratchSource.kind } : null);
      if (!src) throw new Error(source === 'upload' ? 'choose an audio file to upload' : 'split a song and pick a stem to use as the source');
      await startComplete(
        {
          title: title || 'Untitled', prompt, lyrics, model, ...genParams(gen),
          ...(bpm > 0 ? { bpm } : {}),
          ...(keyScale ? { key_scale: keyScale } : {}),
          ...(duration > 0 ? { audio_duration: duration } : {}),
          ...(voice.selectedVoiceId ? { voice_id: voice.selectedVoiceId } : {}),
          ...(folderId ? { folder_id: folderId } : {}),
        },
        src,
        draft,
        voice.uploadedRefFile ?? undefined,
      );
      const failure = useGenerationStore.getState().job;
      if (failure?.stage === 'failed') {
        setError(failure.error ?? 'generation failed');
        dismiss();
        return;
      }
      onBack();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="section-label">SOURCE</div>
      <div className="type-tabs">
        <button className={source === 'upload' ? 'tab active' : 'tab'} onClick={() => setSource('upload')}><span>UPLOAD SINGLE TRACK</span></button>
        <button className={source === 'split' ? 'tab active' : 'tab'} onClick={() => setSource('split')}><span>SPLIT A SONG</span></button>
      </div>
      {source === 'upload' ? (
        <label className="dropzone">
          <input type="file" accept="audio/*" style={{ display: 'none' }} onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)} />
          {uploadFile ? uploadFile.name : 'drag a single track here (e.g. a cappella vocals) or click to browse'}
        </label>
      ) : (
        <>
          {scratchSource && (
            <div className="hint">source: {scratchSource.kind.toUpperCase()} stem — pick a different one below any time</div>
          )}
          <ScratchSplitPicker onUseStem={(jobId, kind) => setScratchSource({ jobId, kind })} />
        </>
      )}

      {arrangeModels === null ? (
        <span className="meta">checking available models…</span>
      ) : arrangeModels.length === 0 ? (
        <span className="meta" style={{ color: 'var(--rust-text)' }}>no downloaded model supports arrange generation — requires a Base model</span>
      ) : (
        <CustomSelect label="MODEL" value={model} onChange={setModel} options={arrangeModels.map((m) => ({ label: m.toUpperCase(), value: m }))} />
      )}

      <div className="query-row">
        <AutoTextarea
          placeholder="Optional — describe the accompaniment (style, mood, instruments)"
          value={prompt}
          onChange={setPrompt}
        />
        <button className={luckyLoading ? 'lucky-btn loading' : 'lucky-btn'} disabled={luckyLoading || busy} onClick={feelingLucky}>
          {luckyLoading ? 'ROLLING…' : 'FEELING LUCKY'}
        </button>
      </div>
      {luckyError && <div className="error">{luckyError} <button onClick={feelingLucky}>RETRY</button></div>}

      <SongAnalysisFields
        analyzing={analysis.analyzing} error={analysis.error}
        lyrics={lyrics} onLyricsChange={setLyrics}
        bpm={bpm} onBpmChange={setBpm}
        duration={duration} onDurationChange={setDuration}
        keyScale={keyScale} onKeyScaleChange={setKeyScale}
      />

      <div className="generate-row">
        <motion.button
          className="acid"
          animate={submitting ? { skewX: 0, backgroundColor: 'transparent', color: '#D4FF00' } : { skewX: -10, backgroundColor: '#D4FF00', color: '#1C1D21' }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          style={{ position: 'relative', overflow: 'hidden' }}
          disabled={busy || !ready}
          onClick={generate}
        >
          {submitting ? (
            <>
              <AIGeneratingBackground />
              <span style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>STARTING…</span>
            </>
          ) : genJob ? 'A GENERATION IS ALREADY RUNNING' : 'ARRANGE'}
        </motion.button>
      </div>
      <div className="hint">Builds a whole new accompaniment around the source track — uses the BASE model, slower than Turbo — can take several minutes.</div>
      {error && <div className="error">{error} <button onClick={generate}>RETRY</button></div>}
    </>
  );
}
