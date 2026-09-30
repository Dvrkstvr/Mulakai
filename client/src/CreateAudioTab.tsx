import { useEffect, useState } from 'react';
import type { Song } from './api';
import { CustomSelect } from './CustomSelect';
import { VarianceSlider } from './SettingsPanel';
import { GenerateButton } from './GenerateButton';
import type { CreateDraft } from './createDraft';
import { useCreateDraftStore } from './createDraftStore';
import { useGenerationStore } from './generationStore';
import { useVoiceStore } from './voiceStore';
import { useModelsForTask } from './useModelsForTask';
import { AutoTextarea } from './AutoTextarea';
import { SongAnalysisFields } from './SongAnalysisFields';
import { AnalyzeAudioButton } from './AnalyzeAudioButton';
import { useAnalyzeAndApply, canAnalyze, type AnalyzeSource } from './useAnalyzeSourceAudio';
import { CoverSourcePicker } from './CoverSourcePicker';
import { CoverEngineChoice } from './EngineChoice';
import { YueCoverPanel } from './YueCoverPanel';
import { coverSourceReady, resolveCoverSource } from './coverSource';
import { CarriedPromptNote } from './CarriedPromptNote';
import { MoveToEditorAction } from './MoveToEditorAction';

/** AUDIO tab: "create cover from audio" — a `cover` generation conditioned on an uploaded
 * file or a client-bounced mix of an existing library song, persisted as a brand-new song.
 * Song intent (prompt/lyrics/details) is shared with the other tabs via createDraftStore;
 * only this tab's source/model/variance choices live in its own slice there. */
export function CreateAudioTab({ songs, onBack }: { songs: Song[]; onBack: () => void }) {
  const draft = useCreateDraftStore();
  const patch = draft.patch;
  const { source, selectedSongId, uploadFile, model, variance } = draft.audio;
  const patchAudio = draft.patchAudio;
  const { title, prompt, lyrics, bpm, keyScale, duration, folderId } = draft;

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const coverModels = useModelsForTask('cover');
  useEffect(() => {
    if (coverModels && !model) patchAudio({ model: coverModels.find((n) => n.includes('xl-sft')) ?? coverModels[0] ?? '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coverModels, model]);

  const genJob = useGenerationStore((s) => s.job);
  const startFromAudio = useGenerationStore((s) => s.startFromAudio);
  const dismiss = useGenerationStore((s) => s.dismiss);
  const voice = useVoiceStore();
  const busy = submitting || !!genJob;

  const sourceReady = coverSourceReady(draft.audio);
  const ready = sourceReady && !!model && (coverModels?.length ?? 0) > 0;

  const resolveSrcAudio = () => resolveCoverSource(draft.audio);

  // Resolves lazily (the library branch bounces a full mix down client-side) so it's only
  // paid for when the user actually clicks ANALYZE AUDIO.
  const analyzeSource: AnalyzeSource = source === 'upload'
    ? (uploadFile ? { kind: 'file', resolve: async () => uploadFile } : null)
    : (selectedSongId ? { kind: 'file', resolve: resolveSrcAudio } : null);
  const analysis = useAnalyzeAndApply(prompt, lyrics, {
    setPrompt: (v) => patch({ prompt: v }),
    setLyrics: (v) => patch({ lyrics: v }),
    setBpm: (v) => patch({ bpm: v }),
    setKeyScale: (v) => patch({ keyScale: v }),
    setDuration: (v) => patch({ duration: v }),
  }, { carried: draft.intentOrigin !== 'audio' });

  const generate = async () => {
    setError('');
    setSubmitting(true);
    const retryDraft: CreateDraft = {
      genType: 'audio', source, selectedSongId: selectedSongId ?? undefined, prompt,
      lyrics, bpm, keyScale, duration,
    };
    try {
      const srcAudio = await resolveSrcAudio();
      await startFromAudio(
        {
          title: title || 'Untitled', prompt, lyrics, model, audio_cover_strength: 1 - variance,
          ...(bpm > 0 ? { bpm } : {}),
          ...(keyScale ? { key_scale: keyScale } : {}),
          ...(duration > 0 ? { audio_duration: duration } : {}),
          ...(voice.selectedVoiceId ? { voice_id: voice.selectedVoiceId } : {}),
          ...(folderId ? { folder_id: folderId } : {}),
        },
        srcAudio,
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

  // An engine cover transcribes the source and sings the score; ACE-Step's model and variance
  // don't apply, and its audio analysis only describes the source (PLAN.md "Client cover
  // decisions", "ANALYZE AUDIO on COVER · YUE2").
  if (draft.audio.engine !== 'acestep') {
    return (
      <>
        <CoverEngineChoice />
        <CoverSourcePicker songs={songs} satisfied={sourceReady || !!draft.audio.yueScore || !!draft.audio.reuseScore} />
        <YueCoverPanel songs={songs} onBack={onBack} noCoverModel={coverModels?.length === 0} />
      </>
    );
  }

  return (
    <>
      <CoverEngineChoice />
      <CoverSourcePicker songs={songs} satisfied={sourceReady} />
      {coverModels === null ? (
        <span className="meta">checking available models…</span>
      ) : coverModels.length === 0 ? (
        <span className="meta" style={{ color: 'var(--rust-text)' }}>no downloaded model supports cover generation</span>
      ) : (
        <CustomSelect label="MODEL" value={model} onChange={(v) => patchAudio({ model: v })} options={coverModels.map((m) => ({ label: m.toUpperCase(), value: m }))} />
      )}
      <VarianceSlider value={Math.round(variance * 100)} onChange={(v) => patchAudio({ variance: v / 100 })} />

      <AutoTextarea
        placeholder="Optional — describe the change (style, mood, instruments). Leave blank to follow the source as-is."
        value={prompt}
        onChange={(v) => patch({ prompt: v })}
      />
      <CarriedPromptNote />
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

      <GenerateButton submitting={submitting} blocked={!!genJob} label="GENERATE COVER" disabled={busy || !ready} onClick={generate} />
      <div className="hint">Renders a new song conditioned on the chosen source track — can take several minutes.</div>
      {error && <div className="error">{error} <button onClick={generate}>RETRY</button></div>}
      {/* Upload only: a library song is already editable from its row's EDIT button, and this
          tab bounces one flat as a source, so offering it here would be ambiguous (PLAN.md). */}
      {source === 'upload' && uploadFile && <MoveToEditorAction file={uploadFile} />}
    </>
  );
}
