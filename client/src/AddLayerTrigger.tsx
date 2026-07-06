import { useEffect, useState } from 'react';
import { api, type Layer } from './api';
import { useSettings, addLayerParams } from './settings';
import { activeLayers } from './mix/activeLayers';
import { decodeLayers } from './mix/decodeLayers';
import { bounceMix, encodeWav } from './mix/bounceMix';
import { VoicePicker } from './VoicePicker';
import { useVoiceStore, voiceParams } from './voiceStore';
import { useGenerationStore } from './generationStore';
import { useEditorJobStore, myEditorJob } from './editorJobStore';
import { fmtElapsed, useElapsedMs } from './genProgress';

interface Props {
  songId: string;
  layers: Layer[];
  onDone: () => Promise<void>;
  /** Notifies LayerStack so it can show a matching ghost lane while the job is in flight. */
  onGeneratingChange?: (generating: boolean) => void;
}

/**
 * Trailing "+ ADD LAYER" row in the lane stack — compact by default,
 * expands to the full form on hover/focus (see .layer-add-row in
 * index.css). Feature-gated to models whose supportedTaskTypes includes
 * 'lego' (Base model only, per docs/ace-step-1.5/API.md#4.2); shows a
 * disabled explanation otherwise.
 */
export function AddLayerTrigger({ songId, layers, onDone, onGeneratingChange }: Props) {
  const { addLayer, setAddLayer, repaint } = useSettings();
  const voice = useVoiceStore();
  const [legoModels, setLegoModels] = useState<string[] | null>(null);
  const [prompt, setPrompt] = useState('');
  const [mixError, setMixError] = useState('');
  const genJob = useGenerationStore((s) => s.job);
  const otherLock = useGenerationStore((s) => s.otherLock);
  const editorJob = useEditorJobStore((s) => s.editorJob);
  const startAddLayer = useEditorJobStore((s) => s.startAddLayer);
  const dismissEditorJob = useEditorJobStore((s) => s.dismiss);
  // Add Layer isn't tied to any one existing layer, so "mine" is just "an addLayer job for this song".
  const mine = myEditorJob(editorJob, 'addLayer', { songId });
  const job: 'idle' | 'running' = mine?.stage === 'running' ? 'running' : 'idle';
  const error = mixError || (mine?.stage === 'failed' ? (mine.error ?? 'add layer failed') : '');
  const busyElsewhere = !mine && (!!genJob || !!editorJob || !!otherLock);
  const elapsedMs = useElapsedMs(job === 'running', mine?.startedAt ?? null);

  useEffect(() => {
    api.listModels()
      .then((data) => {
        const names = data.models.filter((m) => m.supportedTaskTypes.includes('lego')).map((m) => m.name);
        setLegoModels(names);
        if (names.length > 0 && !addLayer.model) setAddLayer({ model: names[0] });
      })
      .catch(() => setLegoModels([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { onGeneratingChange?.(job === 'running'); }, [job, onGeneratingChange]);

  // Runs once when *our* add-layer finishes, even if it settled while this row wasn't mounted
  // (e.g. the user navigated to the Library and back mid-generation).
  useEffect(() => {
    if (mine?.stage === 'done') { setPrompt(''); void onDone(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mine?.stage]);

  const gated = legoModels !== null && legoModels.length === 0;
  const canSubmit = !gated && prompt.trim().length > 0 && job === 'idle' && !busyElsewhere;

  const submit = async () => {
    if (!canSubmit) return;
    setMixError('');
    try {
      const audible = activeLayers(layers)
        .map((l) => l.versions.find((v) => v.active))
        .filter((v): v is NonNullable<typeof v> => !!v);
      if (audible.length === 0) throw new Error('no audible layers to mix — unmute or un-solo at least one layer');

      const mixCtx = new AudioContext();
      const decoded = await decodeLayers(
        audible.map((v, i) => ({ id: String(i), audioUrl: `/audio/${v.audio_file}`, volume: activeLayers(layers)[i].volume })),
        mixCtx,
      );
      const mixed = await bounceMix(decoded);
      await mixCtx.close();
      const mixAudio = encodeWav(mixed);
      const layerName = prompt.trim().split(/\s+/).slice(0, 4).join(' ');

      if (mine?.stage === 'failed') dismissEditorJob();
      void startAddLayer(songId, mixAudio, {
        prompt,
        layerName,
        ...addLayerParams(addLayer, repaint),
        ...voiceParams(voice),
      });
    } catch (err) {
      setMixError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <section className={job === 'running' ? 'layer-add-row generating' : 'layer-add-row'}>
      <div className="layer-add-compact">
        <span className="plus">+</span>
        <span>ADD LAYER</span>
        <span className="hint">{job === 'running' ? `generating… ${fmtElapsed(elapsedMs)}` : 'hover to expand'}</span>
      </div>
      <div className="layer-add-expand">
        {legoModels === null ? (
          <span className="meta">checking available models…</span>
        ) : gated ? (
          <span className="meta" style={{ color: 'var(--rust-text)' }}>
            no downloaded model supports Add Layer — requires a Base model
          </span>
        ) : (
          <>
            <input
              placeholder="Describe what to add (e.g. punchy drums and a walking bassline)"
              value={prompt}
              disabled={job === 'running'}
              onChange={(e) => setPrompt(e.target.value)}
            />
            <VoicePicker />
            <span className="meta">
              STEPS {repaint.inferenceSteps > 0 ? repaint.inferenceSteps : 'AUTO'}
              {' · '}
              GUIDANCE {repaint.guidanceScale > 0 ? repaint.guidanceScale : 'AUTO'}
            </span>
            <button
              className="acid"
              disabled={!canSubmit}
              onClick={submit}
            >
              {job === 'running' ? `GENERATING… ${fmtElapsed(elapsedMs)}` : busyElsewhere ? 'BUSY ELSEWHERE' : 'GENERATE'}
            </button>
            {busyElsewhere && <div className="hint">a generation is already running elsewhere — try again once it finishes</div>}
          </>
        )}
        {error && <div className="error">{error} <button onClick={submit}>RETRY</button></div>}
      </div>
    </section>
  );
}
