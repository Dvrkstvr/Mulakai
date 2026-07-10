import { useEffect, useState } from 'react';
import { api, type Layer, type Version } from './api';
import { activeLayers } from './mix/activeLayers';
import { decodeLayers } from './mix/decodeLayers';
import { bounceMix, encodeWav } from './mix/bounceMix';
import { useSettings } from './settings';
import { useGenerationStore } from './generationStore';
import { useEditorJobStore, myEditorJob } from './editorJobStore';
import { fmtElapsed, fmtProgress, stageDetail, useElapsedMs } from './genProgress';

interface Props {
  songId: string;
  layers: Layer[];
}

/**
 * One-click ACE-Step `cover` pass over the currently audible mix (same
 * mute/solo-aware `activeLayers()` selection Add Layer uses) at the highest
 * quality ACE-Step can produce for this song. No settings form — model is
 * gated to `cover`-capable options (defaulting to xl-sft), steps are fixed,
 * and cover strength/CFG stay at ACE-Step's own defaults (closest to source,
 * auto guidance). The result is never saved to the song's history; it only
 * exists long enough to download — editorJobStore.ts fires that download
 * itself once the job settles, even if this component isn't mounted anymore.
 */
export function RemasterAction({ songId, layers }: Props) {
  const exportSettings = useSettings((s) => s.exportSettings);
  const [coverModels, setCoverModels] = useState<string[] | null>(null);
  const [model, setModel] = useState('');
  const [mixError, setMixError] = useState('');
  const [justFinished, setJustFinished] = useState(false);
  const genJob = useGenerationStore((s) => s.job);
  const otherLock = useGenerationStore((s) => s.otherLock);
  const editorJob = useEditorJobStore((s) => s.editorJob);
  const startRemaster = useEditorJobStore((s) => s.startRemaster);
  const dismissEditorJob = useEditorJobStore((s) => s.dismiss);
  const mine = myEditorJob(editorJob, 'remaster', { songId });
  const job: 'idle' | 'running' = mine?.stage === 'running' ? 'running' : 'idle';
  const error = mixError || (mine?.stage === 'failed' ? (mine.error ?? 'remaster failed') : '');
  const busyElsewhere = !mine && (!!genJob || !!editorJob || !!otherLock);
  const elapsedMs = useElapsedMs(job === 'running', mine?.startedAt ?? null);

  useEffect(() => {
    api.listModels()
      .then((data) => {
        const names = data.models.filter((m) => m.supportedTaskTypes.includes('cover')).map((m) => m.name);
        setCoverModels(names);
        setModel(names.find((n) => n.includes('xl-sft')) ?? names[0] ?? '');
      })
      .catch(() => setCoverModels([]));
  }, []);

  // "downloaded" sticks around after the store clears the job itself (editorJobStore.ts's
  // DONE_LINGER_MS is brief) — this component's own memory of "we just finished" persists
  // until the next REMASTER SONG click.
  useEffect(() => {
    if (mine?.stage === 'done') setJustFinished(true);
  }, [mine?.stage]);

  const gated = coverModels !== null && coverModels.length === 0;

  const submit = async () => {
    if (gated || job === 'running' || busyElsewhere) return;
    setMixError('');
    setJustFinished(false);
    try {
      const audible = activeLayers(layers)
        .map((l) => ({ layer: l, version: l.versions.find((v) => v.active) }))
        .filter((x): x is { layer: Layer; version: Version } => !!x.version);
      if (audible.length === 0) throw new Error('no audible layers to mix — unmute or un-solo at least one layer');

      const mixCtx = new AudioContext();
      const decoded = await decodeLayers(
        audible.map((x, i) => ({ id: String(i), audioUrl: `/audio/${x.version.audio_file}`, volume: x.layer.volume })),
        mixCtx,
      );
      const mixed = await bounceMix(decoded);
      await mixCtx.close();
      const mixAudio = encodeWav(mixed);

      if (mine?.stage === 'failed') dismissEditorJob();
      void startRemaster(songId, mixAudio, model, {
        audioFormat: exportSettings.audioFormat,
        steps: exportSettings.steps,
      });
    } catch (err) {
      setMixError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="remaster-block">
      <span className="section-label" style={{ margin: 0 }}>REMASTER</span>
      <div className="hint">
        one-shot ACE-Step cover of the current mix, aimed at max quality — not saved to history, downloads when done
      </div>
      {coverModels === null ? (
        <span className="meta">checking available models…</span>
      ) : gated ? (
        <span className="meta" style={{ color: 'var(--rust-text)' }}>
          no downloaded model supports Remaster — requires a model with cover support
        </span>
      ) : (
        <>
          <div className="remaster-badges">
            <span className="remaster-badge">{model.toUpperCase()}</span>
            <span className="remaster-badge">{exportSettings.steps} STEPS</span>
            <span className="remaster-badge">{exportSettings.audioFormat.toUpperCase()}</span>
            <span className="remaster-badge">CLOSEST TO SOURCE</span>
          </div>
          <div className="hint">uses Settings &gt; Playback &amp; Export defaults for format/steps</div>
          {justFinished && job === 'idle' ? (
            <span className="meta">remaster downloaded — run it again for another pass</span>
          ) : (
            <>
              <div className="hint">renders the full mix at max quality — can take several minutes</div>
              <button className="acid" disabled={job === 'running' || busyElsewhere} onClick={submit} title={job === 'running' ? mine?.progressText : undefined}>
                {job === 'running'
                  ? `RENDERING… ${fmtElapsed(elapsedMs)}${fmtProgress(mine?.progress) ? ` · ${fmtProgress(mine?.progress)}` : ''}${stageDetail(mine?.progressStage) ? ` · ${stageDetail(mine?.progressStage)}` : ''}`
                  : busyElsewhere ? 'BUSY ELSEWHERE' : 'REMASTER SONG'}
              </button>
              {busyElsewhere && <div className="hint">a generation is already running elsewhere — try again once it finishes</div>}
            </>
          )}
        </>
      )}
      {error && (
        <div className="error">
          {error} <button onClick={submit}>RETRY</button>
        </div>
      )}
    </div>
  );
}
