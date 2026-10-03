import type { ModelInventory, Song } from './api';
import { VarianceSlider } from './SettingsPanel';
import { useCreateDraftStore } from './createDraftStore';
import { useGenerationStore } from './generationStore';
import { busyMessage } from './generationJob';
import { AutoTextarea } from './AutoTextarea';
import { SongAnalysisFields } from './SongAnalysisFields';
import { AnalyzeAudioButton } from './AnalyzeAudioButton';
import { useAnalyzeAndApply, canAnalyze, type AnalyzeSource } from './useAnalyzeSourceAudio';
import { CoverSourcePicker } from './CoverSourcePicker';
import { CoverEngineChoice } from './EngineChoice';
import { aceCoverLocks } from './coverDraft';
import { YueCoverPanel } from './YueCoverPanel';
import { coverSourceReady, resolveCoverSource } from './coverSource';
import { CarriedPromptNote } from './CarriedPromptNote';
import { MoveToEditorAction } from './MoveToEditorAction';
import type { Lookup } from './lookup';
import { CreateStep } from './CreateStep';
import { RecipeCard } from './RecipeCard';
import { RecipeCommit } from './RecipeCommit';
import { GenTune } from './GenTune';
import { useFlowModel } from './useFlowModel';
import { useCoverGenerate } from './useCoverGenerate';

/** START FROM · A SONG I HAVE (was CreateAudioTab.tsx): "create cover from audio" — a `cover`
 * generation conditioned on an uploaded file or a client-bounced mix of a library song. Song
 * intent is shared with the other cards via createDraftStore; only this card's source / model /
 * variance live in its own slice. On an extra engine YueCoverPanel takes the whole flow. */
export function CoverSteps({ songs, onBack, inventory }: {
  songs: Song[];
  onBack: () => void;
  inventory: Lookup<ModelInventory> & { retry: () => void };
}) {
  const draft = useCreateDraftStore();
  const patch = draft.patch;
  const patchAudio = draft.patchAudio;
  const { source, selectedSongId, uploadFile, model, variance } = draft.audio;
  const { prompt, lyrics, bpm, keyScale, duration } = draft;

  const flow = useFlowModel({
    task: 'cover', name: 'Cover', model, setModel: (m) => patchAudio({ model: m }),
    prefer: (ms) => ms.find((n) => n.includes('xl-sft')) ?? ms[0] ?? '',
    none: 'no downloaded model supports cover generation',
  });
  const blockedBy = useGenerationStore((s) => busyMessage(s.job, s.otherLock));
  const { submitting, error, generate } = useCoverGenerate(onBack);
  const busy = submitting || !!blockedBy;
  const sourceReady = coverSourceReady(draft.audio);

  // Resolves lazily (the library branch bounces a full mix down client-side) so it's only
  // paid for when the user actually clicks ANALYZE AUDIO.
  const analyzeSource: AnalyzeSource = source === 'upload'
    ? (uploadFile ? { kind: 'file', resolve: async () => uploadFile } : null)
    : (selectedSongId ? { kind: 'file', resolve: () => resolveCoverSource(draft.audio) } : null);
  const analysis = useAnalyzeAndApply(prompt, lyrics, {
    setPrompt: (v) => patch({ prompt: v }),
    setLyrics: (v) => patch({ lyrics: v }),
    setBpm: (v) => patch({ bpm: v }),
    setKeyScale: (v) => patch({ keyScale: v }),
    setDuration: (v) => patch({ duration: v }),
  }, { carried: draft.intentOrigin !== 'audio' });
  const locks = aceCoverLocks({ analyzing: analysis.analyzing, generating: busy });

  // An engine cover transcribes the source and sings the score; ACE-Step's model and variance
  // don't apply, and its audio analysis only describes the source (PLAN.md "Client cover
  // decisions", "ANALYZE AUDIO on COVER · YUE2").
  if (draft.audio.engine !== 'acestep') {
    return <YueCoverPanel songs={songs} onBack={onBack} noCoverModel={flow.noModel} inventory={inventory} />;
  }

  return (
    <>
      <div className="create-steps">
        <CreateStep n={1} title="PICK THE SONG">
          <CoverSourcePicker songs={songs} satisfied={sourceReady} lockedBy={locks.source} />
          {/* Upload only: a library song is already editable from its row's EDIT button, and this
              flow bounces one flat as a source, so offering it here would be ambiguous (PLAN.md). */}
          {source === 'upload' && uploadFile && <MoveToEditorAction file={uploadFile} />}
        </CreateStep>
        <CreateStep n={2} title="WHAT CHANGES?">
          <AutoTextarea
            placeholder="Optional — describe the change (style, mood, instruments). Leave blank to follow the source as-is."
            value={prompt} onChange={(v) => patch({ prompt: v })} />
          <CarriedPromptNote />
          <VarianceSlider value={Math.round(variance * 100)} onChange={(v) => patchAudio({ variance: v / 100 })} />
          <AnalyzeAudioButton disabled={!canAnalyze(analyzeSource, model, busy || analysis.analyzing)}
            analyzing={analysis.analyzing} onClick={() => analysis.analyze(analyzeSource, model)} />
        </CreateStep>
        <CreateStep n={3} optional title="LYRICS" sub="from ANALYZE AUDIO, or your own · edit freely">
          <SongAnalysisFields
            analyzing={analysis.analyzing} error={analysis.error}
            lyrics={lyrics} onLyricsChange={(v) => patch({ lyrics: v })}
            bpm={bpm} onBpmChange={(v) => patch({ bpm: v })}
            duration={duration} onDurationChange={(v) => patch({ duration: v })}
            keyScale={keyScale} onKeyScaleChange={(v) => patch({ keyScale: v })} />
        </CreateStep>
      </div>
      {/* ENGINE holds still while ANALYZE AUDIO runs: its result would land in the other engine's draft. */}
      <RecipeCard stepsModel={model} engine={<CoverEngineChoice lockedBy={locks.engine} />}
        tune={<GenTune inventory={inventory} modelControl={flow.control} flowModel={model} modelDefault={flow.preferred} stepsModel={model} />}
        commit={(
          <RecipeCommit label="GENERATE COVER" submitting={submitting} blocked={blockedBy} error={error} onClick={generate}
            disabled={busy || !sourceReady || !flow.ready}>
            {flow.problem}
            <div className="hint">Renders a new song conditioned on the chosen source track — can take several minutes.</div>
          </RecipeCommit>
        )} />
    </>
  );
}
