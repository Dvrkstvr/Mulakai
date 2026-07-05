import { useEffect, useState } from 'react';
import { api, type Layer } from './api';
import { useSettings, addLayerParams } from './settings';
import { activeLayers } from './mix/activeLayers';
import { decodeLayers } from './mix/decodeLayers';
import { bounceMix, encodeWav } from './mix/bounceMix';

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
  const [legoModels, setLegoModels] = useState<string[] | null>(null);
  const [prompt, setPrompt] = useState('');
  const [job, setJob] = useState<'idle' | 'running'>('idle');
  const [error, setError] = useState('');

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

  const gated = legoModels !== null && legoModels.length === 0;
  const canSubmit = !gated && prompt.trim().length > 0 && job === 'idle';

  const submit = async () => {
    if (!canSubmit) return;
    setError('');
    setJob('running');
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
      const { jobId } = await api.addLayer(songId, mixAudio, {
        prompt,
        layerName,
        ...addLayerParams(addLayer, repaint),
      });
      for (;;) {
        await new Promise((r) => setTimeout(r, 2000));
        const s = await api.jobStatus(jobId);
        if (s.status === 'done') break;
        if (s.status === 'failed') throw new Error(s.error ?? 'add layer failed');
      }
      setPrompt('');
      await onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setJob('idle');
    }
  };

  return (
    <section className={job === 'running' ? 'layer-add-row generating' : 'layer-add-row'}>
      <div className="layer-add-compact">
        <span className="plus">+</span>
        <span>ADD LAYER</span>
        <span className="hint">{job === 'running' ? 'generating…' : 'hover to expand'}</span>
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
              {job === 'running' ? 'GENERATING…' : 'GENERATE'}
            </button>
          </>
        )}
        {error && <div className="error">{error} <button onClick={submit}>RETRY</button></div>}
      </div>
    </section>
  );
}
