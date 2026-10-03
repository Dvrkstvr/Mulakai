import { useState } from 'react';
import { api, type ModelInventory } from './api';
import { ScratchSplitPicker } from './ScratchSplitPicker';
import { useCreateDraftStore } from './createDraftStore';
import { useGenerationStore } from './generationStore';
import { busyMessage } from './generationJob';
import { AutoTextarea } from './AutoTextarea';
import { SongAnalysisFields } from './SongAnalysisFields';
import { AnalyzeAudioButton } from './AnalyzeAudioButton';
import { Dropzone } from './Dropzone';
import { AudioPreview } from './AudioPreview';
import { useObjectUrl } from './useObjectUrl';
import { useAnalyzeAndApply, canAnalyze, type AnalyzeSource } from './useAnalyzeSourceAudio';
import { ReusedSourceNote } from './ReusedSourceNote';
import { CarriedPromptNote } from './CarriedPromptNote';
import { AceStepOnly } from './EngineChoice';
import type { Lookup } from './lookup';
import { CreateStep } from './CreateStep';
import { RecipeCard } from './RecipeCard';
import { RecipeCommit } from './RecipeCommit';
import { GenTune } from './GenTune';
import { useFlowModel } from './useFlowModel';
import { useTrackGenerate } from './useTrackGenerate';

/** START FROM · ONE TRACK (was CreateArrangeTab.tsx): ACE-Step's `complete` task — a whole
 * accompaniment around one bare source track (as opposed to A SONG I HAVE's `cover`, which
 * regenerates a full mix, or the Editor's Add Layer `lego`, which adds one part). ACE-Step skips
 * the in-generation LM for `complete` (upstream #1287), so TUNE hides THINKING MODE here; AI
 * ENHANCE stays, since use_format is formatted API-side before generation. */
export function TrackSteps({ onBack, inventory }: { onBack: () => void; inventory: Lookup<ModelInventory> & { retry: () => void } }) {
  const draft = useCreateDraftStore();
  const patch = draft.patch;
  const patchArrange = draft.patchArrange;
  const { source, uploadFile, scratchSource, model } = draft.arrange;
  const { prompt, lyrics, bpm, keyScale, duration } = draft;

  const uploadUrl = useObjectUrl(uploadFile);
  const [luckyLoading, setLuckyLoading] = useState(false);
  const [luckyError, setLuckyError] = useState('');
  const flow = useFlowModel({
    task: 'complete', name: 'Arrange', model, setModel: (m) => patchArrange({ model: m }),
    prefer: (ms) => ms.find((n) => n.includes('xl-base')) ?? ms.find((n) => n.includes('base')) ?? ms[0] ?? '',
    none: 'no downloaded model supports arrange generation — requires a Base model',
  });
  const blockedBy = useGenerationStore((s) => busyMessage(s.job, s.otherLock));
  const { submitting, error, generate } = useTrackGenerate(onBack);
  const busy = submitting || !!blockedBy;
  const sourceReady = source === 'upload' ? !!uploadFile : !!scratchSource;

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
      patch({ prompt: (await api.randomSample()).caption });
    } catch (err) {
      setLuckyError(err instanceof Error ? err.message : String(err));
    } finally {
      setLuckyLoading(false);
    }
  };

  return (
    <>
      <div className="create-steps">
        <CreateStep n={1} title="YOUR TRACK" actions={<div className="type-tabs">
          <button className={source === 'upload' ? 'tab active' : 'tab'} onClick={() => patchArrange({ source: 'upload' })}><span>UPLOAD A TRACK</span></button>
          <button className={source === 'split' ? 'tab active' : 'tab'} onClick={() => patchArrange({ source: 'split' })}><span>PULL ONE FROM A SONG</span></button>
        </div>}>
          <ReusedSourceNote title={draft.reusedFrom} satisfied={sourceReady} />
          {source === 'upload' ? (
            <>
              <Dropzone accept="audio/*" onFile={(f) => patchArrange({ uploadFile: f })}>
                {uploadFile ? uploadFile.name : 'drag a single track here (e.g. a cappella vocals) or click to browse'}
              </Dropzone>
              {uploadFile && uploadUrl && <AudioPreview src={uploadUrl} label={uploadFile.name} height={26} />}
            </>
          ) : (
            <>
              {scratchSource && <div className="hint">source: {scratchSource.kind.toUpperCase()} stem — pick a different one below any time</div>}
              <ScratchSplitPicker onUseStem={(jobId, kind) => patchArrange({ scratchSource: { jobId, kind } })} />
            </>
          )}
        </CreateStep>
        <CreateStep n={2} title="DESCRIBE THE BAND AROUND IT">
          <div className="query-row">
            <AutoTextarea placeholder="Optional — describe the accompaniment (style, mood, instruments)"
              value={prompt} onChange={(v) => patch({ prompt: v })} />
            <button className={luckyLoading ? 'lucky-btn loading' : 'lucky-btn'} disabled={luckyLoading || busy} onClick={feelingLucky}>
              {luckyLoading ? 'ROLLING…' : 'FEELING LUCKY'}
            </button>
          </div>
          <CarriedPromptNote />
          {luckyError && <div className="error">{luckyError} <button onClick={feelingLucky}>RETRY</button></div>}
          <AnalyzeAudioButton disabled={!canAnalyze(analyzeSource, model, busy || analysis.analyzing)}
            analyzing={analysis.analyzing} onClick={() => analysis.analyze(analyzeSource, model)} />
        </CreateStep>
        <CreateStep n={3} optional title="LYRICS + DETAILS" sub="ANALYZE AUDIO fills these from your track · edit freely">
          <SongAnalysisFields
            analyzing={analysis.analyzing} error={analysis.error}
            lyrics={lyrics} onLyricsChange={(v) => patch({ lyrics: v })}
            bpm={bpm} onBpmChange={(v) => patch({ bpm: v })}
            duration={duration} onDurationChange={(v) => patch({ duration: v })}
            keyScale={keyScale} onKeyScaleChange={(v) => patch({ keyScale: v })} />
        </CreateStep>
      </div>
      <RecipeCard stepsModel={model} engine={<AceStepOnly />}
        tune={<GenTune inventory={inventory} modelControl={flow.control} flowModel={model} modelDefault={flow.preferred} stepsModel={model} />}
        commit={(
          <RecipeCommit label="ARRANGE" submitting={submitting} blocked={blockedBy} error={error} onClick={generate}
            disabled={busy || !sourceReady || !flow.ready}>
            {flow.problem}
            <div className="hint">Builds a whole new accompaniment around the source track — uses the BASE model, slower than Turbo — can take several minutes.</div>
          </RecipeCommit>
        )} />
    </>
  );
}
