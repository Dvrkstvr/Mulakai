import { useEffect, useState } from 'react';
import { type Layer } from './api';
import { useAddLayerDraft } from './addLayerStore';
import { useSettings, addLayerParams } from './settings';
import { bounceAudible } from './mixExport';
import { useVoiceStore, voiceParams } from './voiceStore';
import { useEditorJobStore, myEditorJobs, jobView } from './editorJobStore';
import { ActiveAdapterNote } from './ActiveAdapterNote';
import { queueSuffix } from './queueCopy';
import { useJobsAhead } from './queueStore';
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
}

/**
 * ADD LAYER: a new lane conditioned on the current mix (mute/solo-aware). Feature-gated to models
 * whose supportedTaskTypes include 'lego' (Base only, docs/ace-step-1.5/API.md#4.2); says why when
 * none is downloaded. A busy GPU doesn't hold it: the server queues each ADD and its lines list
 * under the commit.
 */
export function DockAddLayer({ songId, layers, songLyrics }: Props) {
  const { addLayer, setAddLayer, repaint } = useSettings();
  const voice = useVoiceStore();
  const resetDraft = useAddLayerDraft((s) => s.reset);
  const [prompt, setPrompt] = useState('');
  const [trackName, setTrackName] = useState('');
  const [mixError, setMixError] = useState('');
  const editorJobs = useEditorJobStore((s) => s.editorJobs);
  const startAddLayer = useEditorJobStore((s) => s.startAddLayer);
  const dismiss = useEditorJobStore((s) => s.dismiss);
  const ahead = useJobsAhead();
  // Add Layer isn't tied to any one existing layer, so "mine" is every addLayer job for this song.
  const { inFlight, failed, landed } = jobView(myEditorJobs(editorJobs, 'addLayer', { songId }));
  const error = mixError || (failed ? (failed.error ?? 'add layer failed') : '');

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

  // Once the last of this song's add-layers lands (even while the Editor wasn't mounted), the
  // fields start over; the Editor reloads the song itself (useLandedReload).
  useEffect(() => {
    if (landed && inFlight.length === 0) { setPrompt(''); setTrackName(''); resetDraft(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [landed]);

  const canSubmit = !!legoModels.data?.length && prompt.trim().length > 0;
  const layerName = addLayerName(prompt, trackName);

  const submit = async () => {
    if (!canSubmit) return;
    setMixError('');
    try {
      const mixAudio = await bounceAudible(layers);
      if (failed) dismiss(failed.key);
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

  return (
    <>
      <div className="dock-body">
        <DockAddLayerFields trackName={trackName} onTrackName={setTrackName} prompt={prompt} onPrompt={setPrompt}
          songLyrics={songLyrics} />
        <VoicePicker />
        <AddLayerTune legoModels={legoModels.data} />
      </div>
      <DockCommit
        consequence={addLayerConsequence(layerName) + queueSuffix(ahead)}
        label={addLayerCommitLabel(trackName)}
        disabled={!canSubmit}
        onCommit={() => void submit()}
        jobs={inFlight}
      />
      <ActiveAdapterNote />
      {error && <div className="error">{error} <button onClick={() => void submit()}>RETRY</button></div>}
    </>
  );
}
