import { useState } from 'react';
import { type Layer } from './api';
import { bounceAudible } from './mixExport';
import { useSettings } from './settings';
import { AudioPreview } from './AudioPreview';
import { useEditorJobStore, myEditorJobs, jobView } from './editorJobStore';
import { useRemasterResult } from './remasterResult';
import { ActiveAdapterNote } from './ActiveAdapterNote';
import { queueSuffix } from './queueCopy';
import { useJobsAhead } from './queueStore';
import { useLookup, modelsFor, checkingModels } from './lookup';
import { DockCommit } from './DockCommit';

interface Props {
  songId: string;
  layers: Layer[];
}

/**
 * EXPORT › REMASTERED MIX: a one-click ACE-Step `cover` pass over the currently audible mix
 * (the same mute/solo-aware bounce Add Layer uses) at the highest quality ACE-Step can
 * produce for this song. No settings form — model is gated to `cover`-capable options
 * (defaulting to xl-sft), steps and format come from Settings, and cover strength/CFG stay
 * at ACE-Step's own defaults (closest to source, auto guidance). The result is never saved
 * to the song's history; it only exists long enough to download — editorJobStore.ts fires
 * that download itself once the job settles, even if this component isn't mounted anymore.
 */
export function RemasterAction({ songId, layers }: Props) {
  const exportSettings = useSettings((s) => s.exportSettings);
  const [model, setModel] = useState('');
  const [mixError, setMixError] = useState('');
  const editorJobs = useEditorJobStore((s) => s.editorJobs);
  const remasterResult = useRemasterResult((s) => s.result);
  const startRemaster = useEditorJobStore((s) => s.startRemaster);
  const dismiss = useEditorJobStore((s) => s.dismiss);
  const ahead = useJobsAhead();
  const result = remasterResult?.songId === songId ? remasterResult : null;
  const { inFlight, failed } = jobView(myEditorJobs(editorJobs, 'remaster', { songId }));
  const error = mixError || (failed ? (failed.error ?? 'remaster failed') : '');

  const coverModels = useLookup(() => modelsFor('cover').then((names) => {
    setModel(names.find((n) => n.includes('xl-sft')) ?? names[0] ?? '');
    return names;
  }));

  const gated = !coverModels.data?.length;

  const submit = async () => {
    if (gated) return;
    setMixError('');
    try {
      const mixAudio = await bounceAudible(layers);
      if (failed) dismiss(failed.key);
      void startRemaster(songId, mixAudio, model, {
        audioFormat: exportSettings.audioFormat,
        steps: exportSettings.steps,
      });
    } catch (err) {
      setMixError(err instanceof Error ? err.message : String(err));
    }
  };

  // A held result is offered until the next run starts; while one is on its way, the commit
  // queues another and the lines under it say how far the first has got.
  const held = result && inFlight.length === 0 ? result : null;
  return (
    <>
      <div className="dock-body remaster-block">
        {coverModels.error ? (
          <div className="error">
            couldn't check models for Remaster — {coverModels.error} <button onClick={coverModels.retry}>RETRY</button>
          </div>
        ) : coverModels.data === null ? (
          <span className="meta">{checkingModels(coverModels)}</span>
        ) : gated ? (
          <span className="meta" style={{ color: 'var(--rust-text)' }}>
            no downloaded model supports Remaster — requires a model with cover support
          </span>
        ) : (
          <>
            <div className="remaster-badges" aria-label="Format">
              <span className="remaster-badge">{model.toUpperCase()}</span>
              <span className="remaster-badge">{exportSettings.steps} STEPS</span>
              <span className="remaster-badge">{exportSettings.audioFormat.toUpperCase()}</span>
              <span className="remaster-badge">CLOSEST TO SOURCE</span>
            </div>
            <div className="hint">format and steps come from Settings › Playback &amp; Export</div>
            {held && <AudioPreview src={held.url} label="remaster result" height={24} />}
          </>
        )}
      </div>
      {!gated && (held ? (
        <DockCommit
          consequence="not saved to history — download it, or run again to discard it"
          label="DOWNLOAD"
          download={{ href: held.url, filename: held.filename }}
          siblings={<button className="acid-outline" onClick={() => void submit()}>RUN AGAIN</button>}
        />
      ) : (
        <DockCommit
          consequence={`runs one ACE-Step pass over the mix first, about 90 s, and isn't kept${queueSuffix(ahead)}`}
          label="REMASTER MIX"
          onCommit={() => void submit()}
          jobs={inFlight}
        />
      ))}
      {!gated && !held && <ActiveAdapterNote />}
      {error && <div className="error">{error} <button onClick={() => void submit()}>RETRY</button></div>}
    </>
  );
}
