import { useEffect, useState } from 'react';
import { api } from './api';
import { CustomSelect } from './CustomSelect';
import { GenerateButton } from './GenerateButton';
import { ScratchSplitPicker } from './ScratchSplitPicker';
import type { CreateDraft } from './createDraft';
import { useCreateDraftStore } from './createDraftStore';
import { useGenerationStore } from './generationStore';
import { useVoiceStore } from './voiceStore';
import { useModelsForTask } from './useModelsForTask';
import { useSettings, genParams } from './settings';
import { AutoTextarea } from './AutoTextarea';
import { SongAnalysisFields } from './SongAnalysisFields';
import { AnalyzeAudioButton } from './AnalyzeAudioButton';
import { Dropzone } from './Dropzone';
import { AudioPreview } from './AudioPreview';
import { useObjectUrl } from './useObjectUrl';
import { useAnalyzeAndApply, canAnalyze, type AnalyzeSource } from './useAnalyzeSourceAudio';
import { ReusedSourceNote } from './ReusedSourceNote';
import { CarriedPromptNote } from './CarriedPromptNote';

/** ARRANGE tab: ACE-Step's `complete` task — build a whole accompaniment around a single
 * bare source track (as opposed to AUDIO's `cover`, which regenerates a full existing mix
 * keeping its structure, or the Editor's Add Layer `lego`, which adds one part to an
 * already-multi-layer song). Unlike AUDIO, the 5Hz LM is NOT skipped for `complete`
 * (docs/ace-step-1.5/API.md#4.2), so THINKING MODE / AI ENHANCE in the sidebar are live here —
 * see CreateView.tsx's `hideLmControls` check, which only targets the AUDIO tab.
 * Song intent is shared via createDraftStore; only source/model live in this tab's slice. */
export function CreateArrangeTab({ onBack }: { onBack: () => void }) {
  const gen = useSettings((s) => s.gen);
  const draft = useCreateDraftStore();
  const patch = draft.patch;
  const patchArrange = draft.patchArrange;
  const { source, uploadFile, scratchSource, model } = draft.arrange;
  const { title, prompt, lyrics, bpm, keyScale, duration, folderId } = draft;

  const uploadUrl = useObjectUrl(uploadFile);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [luckyLoading, setLuckyLoading] = useState(false);
  const [luckyError, setLuckyError] = useState('');

  const arrangeModels = useModelsForTask('complete');
  useEffect(() => {
    if (arrangeModels && !model) patchArrange({ model: arrangeModels.find((n) => n.includes('xl-base')) ?? arrangeModels.find((n) => n.includes('base')) ?? arrangeModels[0] ?? '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arrangeModels, model]);

  const genJob = useGenerationStore((s) => s.job);
  const startComplete = useGenerationStore((s) => s.startComplete);
  const dismiss = useGenerationStore((s) => s.dismiss);
  const voice = useVoiceStore();
  const busy = submitting || !!genJob;

  const sourceReady = source === 'upload' ? !!uploadFile : !!scratchSource;
  const ready = sourceReady && !!model && (arrangeModels?.length ?? 0) > 0;

  const analyzeSource: AnalyzeSource = source === 'upload'
    ? (uploadFile ? { kind: 'file', resolve: async () => uploadFile } : null)
    : (scratchSource ? { kind: 'scratch', jobId: scratchSource.jobId, stemKind: scratchSource.kind } : null);
  const analysis = useAnalyzeAndApply(prompt, lyrics, {
    setPrompt: (v) => patch({ prompt: v }),
    setLyrics: (v) => patch({ lyrics: v }),
    setBpm: (v) => patch({ bpm: v }),
    setKeyScale: (v) => patch({ keyScale: v }),
    setDuration: (v) => patch({ duration: v }),
  }, { carried: draft.intentOrigin !== 'complete' });

  const feelingLucky = async () => {
    setLuckyError('');
    setLuckyLoading(true);
    try {
      const sample = await api.randomSample();
      patch({ prompt: sample.caption });
    } catch (err) {
      setLuckyError(err instanceof Error ? err.message : String(err));
    } finally {
      setLuckyLoading(false);
    }
  };

  const generate = async () => {
    setError('');
    setSubmitting(true);
    const retryDraft: CreateDraft = { genType: 'complete', prompt, lyrics, bpm, keyScale, duration };
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
        retryDraft,
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
      <ReusedSourceNote title={draft.reusedFrom} satisfied={sourceReady} />
      <div className="type-tabs">
        <button className={source === 'upload' ? 'tab active' : 'tab'} onClick={() => patchArrange({ source: 'upload' })}><span>UPLOAD SINGLE TRACK</span></button>
        <button className={source === 'split' ? 'tab active' : 'tab'} onClick={() => patchArrange({ source: 'split' })}><span>SPLIT A SONG</span></button>
      </div>
      {source === 'upload' ? (
        <>
          <Dropzone accept="audio/*" onFile={(f) => patchArrange({ uploadFile: f })}>
            {uploadFile ? uploadFile.name : 'drag a single track here (e.g. a cappella vocals) or click to browse'}
          </Dropzone>
          {uploadFile && uploadUrl && <AudioPreview src={uploadUrl} label={uploadFile.name} height={26} />}
        </>
      ) : (
        <>
          {scratchSource && (
            <div className="hint">source: {scratchSource.kind.toUpperCase()} stem — pick a different one below any time</div>
          )}
          <ScratchSplitPicker onUseStem={(jobId, kind) => patchArrange({ scratchSource: { jobId, kind } })} />
        </>
      )}

      {arrangeModels === null ? (
        <span className="meta">checking available models…</span>
      ) : arrangeModels.length === 0 ? (
        <span className="meta" style={{ color: 'var(--rust-text)' }}>no downloaded model supports arrange generation — requires a Base model</span>
      ) : (
        <CustomSelect label="MODEL" value={model} onChange={(v) => patchArrange({ model: v })} options={arrangeModels.map((m) => ({ label: m.toUpperCase(), value: m }))} />
      )}

      <div className="query-row">
        <AutoTextarea
          placeholder="Optional — describe the accompaniment (style, mood, instruments)"
          value={prompt}
          onChange={(v) => patch({ prompt: v })}
        />
        <button className={luckyLoading ? 'lucky-btn loading' : 'lucky-btn'} disabled={luckyLoading || busy} onClick={feelingLucky}>
          {luckyLoading ? 'ROLLING…' : 'FEELING LUCKY'}
        </button>
      </div>
      <CarriedPromptNote />
      {luckyError && <div className="error">{luckyError} <button onClick={feelingLucky}>RETRY</button></div>}

      <AnalyzeAudioButton
        disabled={!canAnalyze(analyzeSource, model, busy || analysis.analyzing)}
        analyzing={analysis.analyzing}
        onClick={() => analysis.analyze(analyzeSource, model)}
      />
      <SongAnalysisFields
        analyzing={analysis.analyzing} error={analysis.error}
        lyrics={lyrics} onLyricsChange={(v) => patch({ lyrics: v })}
        bpm={bpm} onBpmChange={(v) => patch({ bpm: v })}
        duration={duration} onDurationChange={(v) => patch({ duration: v })}
        keyScale={keyScale} onKeyScaleChange={(v) => patch({ keyScale: v })}
      />

      <GenerateButton submitting={submitting} blocked={!!genJob} label="ARRANGE" disabled={busy || !ready} onClick={generate} />
      <div className="hint">Builds a whole new accompaniment around the source track — uses the BASE model, slower than Turbo — can take several minutes.</div>
      {error && <div className="error">{error} <button onClick={generate}>RETRY</button></div>}
    </>
  );
}
