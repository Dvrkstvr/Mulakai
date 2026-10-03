import { useEffect, useState } from 'react';
import { type Layer } from './api';
import { useAddLayerDraft } from './addLayerStore';
import { useSettings, addLayerParams } from './settings';
import { bounceAudible } from './mixExport';
import { useVoiceStore, voiceParams } from './voiceStore';
import { useGenerationStore } from './generationStore';
import { isGenerating, lockHolder, waitLabel } from './generationJob';
import { useEditorJobStore, myEditorJob, isEditorBusy, selectSplitRunning } from './editorJobStore';
import { ActiveAdapterNote } from './ActiveAdapterNote';
import { fmtElapsed, fmtProgress, stageDetail, useElapsedMs } from './genProgress';
import { useLookup, modelsFor, checkingModels } from './lookup';
import { VoicePicker } from './VoicePicker';
import { AddLayerTune } from './AddLayerTune';
import { DockCommit } from './DockCommit';
import { DockAddLayerFields } from './DockAddLayerFields';
import { addLayerName, addLayerCommitLabel, addLayerConsequence, sungTrack } from './addLayerCopy';
import { useDockRequest } from './dockRequest';

interface Props {
  songId: string;
  layers: Layer[];
  songLyrics: string;
  onDone: () => Promise<void>;
}

/**
 * ADD LAYER: a new lane conditioned on the current mix (mute/solo-aware). Feature-gated to models
 * whose supportedTaskTypes include 'lego' (Base only, docs/ace-step-1.5/API.md#4.2); says why when
 * none is downloaded. Stays mounted while another verb is showing, so a layer that lands then
 * still reloads the song.
 */
export function DockAddLayer({ songId, layers, songLyrics, onDone }: Props) {
  const { addLayer, setAddLayer, repaint } = useSettings();
  const voice = useVoiceStore();
  const resetDraft = useAddLayerDraft((s) => s.reset);
  const [prompt, setPrompt] = useState('');
  const [trackName, setTrackName] = useState('');
  const [mixError, setMixError] = useState('');
  const genRunning = useGenerationStore((s) => isGenerating(s.job));
  const otherLock = useGenerationStore((s) => s.otherLock);
  const editorJob = useEditorJobStore((s) => s.editorJob);
  const splitRunning = useEditorJobStore(selectSplitRunning);
  const startAddLayer = useEditorJobStore((s) => s.startAddLayer);
  const dismissEditorJob = useEditorJobStore((s) => s.dismiss);
  // Add Layer isn't tied to any one existing layer, so "mine" is just "an addLayer job for this song".
  const mine = myEditorJob(editorJob, 'addLayer', { songId });
  const running = mine?.stage === 'running';
  const error = mixError || (mine?.stage === 'failed' ? (mine.error ?? 'add layer failed') : '');
  const busyElsewhere = splitRunning || (!mine && (genRunning || isEditorBusy(editorJob) || !!otherLock));
  const busyBy = busyElsewhere ? lockHolder({ generating: genRunning, otherLock, editorJob, splitRunning }) : null;
  const elapsedMs = useElapsedMs(running, mine?.startedAt ?? null);

  const legoModels = useLookup(() => modelsFor('lego').then((names) => {
    if (names.length > 0 && !addLayer.model) setAddLayer({ model: names[0] });
    return names;
  }));

  // A track picked from outside the dock (the palette's "Add layer · strings").
  const trackPick = useDockRequest((s) => s.track);
  useEffect(() => {
    if (trackPick === null) return;
    setTrackName(trackPick);
    useDockRequest.setState({ track: null });
  }, [trackPick]);

  // Runs once when *our* add-layer finishes, even if it settled while the Editor wasn't mounted.
  useEffect(() => {
    if (mine?.stage === 'done') { setPrompt(''); setTrackName(''); resetDraft(); void onDone(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mine?.stage]);

  const canSubmit = !!legoModels.data?.length && prompt.trim().length > 0 && !running && !busyElsewhere;
  const layerName = addLayerName(prompt, trackName);

  const submit = async () => {
    if (!canSubmit) return;
    setMixError('');
    try {
      const mixAudio = await bounceAudible(layers);
      if (mine?.stage === 'failed') dismissEditorJob();
      const lyrics = sungTrack(trackName) ? useAddLayerDraft.getState().lyrics.trim() : '';
      void startAddLayer(songId, mixAudio, {
        prompt,
        layerName,
        ...(lyrics ? { lyrics } : {}),
        ...(trackName ? { track_name: trackName } : {}),
        ...addLayerParams(addLayer, repaint),
        ...voiceParams(voice),
      });
    } catch (err) {
      setMixError(err instanceof Error ? err.message : String(err));
    }
  };

  if (legoModels.error || legoModels.data === null || legoModels.data.length === 0) {
    return (
      <div className="dock-body">
        {legoModels.error ? (
          <div className="error">couldn't check models for Add Layer — {legoModels.error} <button onClick={legoModels.retry}>RETRY</button></div>
        ) : legoModels.data === null ? (
          <span className="meta">{checkingModels(legoModels)}</span>
        ) : (
          <span className="meta" style={{ color: 'var(--rust-text)' }}>no downloaded model supports Add Layer — requires a Base model</span>
        )}
      </div>
    );
  }

  const progress = `${fmtProgress(mine?.progress) ? ` · ${fmtProgress(mine?.progress)}` : ''}${stageDetail(mine?.progressStage) ? ` · ${stageDetail(mine?.progressStage)}` : ''}`;
  return (
    <>
      <div className="dock-body">
        <DockAddLayerFields trackName={trackName} onTrackName={setTrackName} prompt={prompt} onPrompt={setPrompt}
          disabled={running} songLyrics={songLyrics} />
        <VoicePicker />
        <AddLayerTune legoModels={legoModels.data} />
      </div>
      <DockCommit
        consequence={addLayerConsequence(layerName)}
        label={running ? `GENERATING… ${fmtElapsed(elapsedMs)}${progress}` : busyBy ? waitLabel(busyBy) : addLayerCommitLabel(trackName)}
        disabled={!canSubmit}
        running={running}
        progress={mine?.progress}
        title={running ? mine?.progressText : undefined}
        onCommit={() => void submit()}
      />
      {busyElsewhere && <div className="hint">only one job can use the GPU at a time — try again once it finishes</div>}
      <ActiveAdapterNote />
      {error && <div className="error">{error} <button onClick={() => void submit()}>RETRY</button></div>}
    </>
  );
}
