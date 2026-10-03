import { useEffect } from 'react';
import type { Layer } from './api';
import type { Region } from './Waveform';
import { repaintParams, type RepaintSettings } from './settings';
import { clampCrossfade, repaintRangeValid } from './repaintLimits';
import type { useEditorRepaintJob } from './useEditorRepaintJob';

type RepaintJob = Pick<ReturnType<typeof useEditorRepaintJob>, 'startRepaint' | 'dismissEditorJob' | 'myRepaint' | 'busyElsewhere'>;

interface RequestInputs {
  selection: Region | null;
  /** The song's length (0 = unknown), which a whole-layer repaint covers. */
  duration: number;
  prompt: string;
  lyricsUnlocked: boolean;
  lyricsDraft: string;
  repaintSettings: RepaintSettings;
}

interface Options extends RepaintJob, RequestInputs {
  songId: string;
  focusedLayer: Layer | undefined;
  setSelection: (selection: Region | null) => void;
  setPrompt: (prompt: string) => void;
  reload: () => Promise<void>;
}

/**
 * The repaint request for a range, or null when it is outside the 3–90 s limit. No selection is
 * the whole layer (DESIGN's "empty selection = whole song scope"), held to the same limit by
 * the song's length: the server reads end -1 as "to the end", and there is no boundary to
 * crossfade.
 */
export function repaintRequest({ selection, duration, prompt, lyricsUnlocked, lyricsDraft, repaintSettings }: RequestInputs) {
  if (!repaintRangeValid(selection, duration)) return null;
  return {
    prompt,
    start: selection?.start ?? 0,
    end: selection?.end ?? -1,
    ...(lyricsUnlocked ? { lyrics: lyricsDraft } : {}),
    ...repaintParams(repaintSettings),
    repaint_wav_crossfade_sec: clampCrossfade(repaintSettings.crossfadeSec, selection ? selection.end - selection.start : 0),
  };
}

/** Submits the Editor's repaint of the selected range, and clears it once *our* repaint lands. */
export function useRepaintSubmit({
  songId, focusedLayer, startRepaint, dismissEditorJob, myRepaint, busyElsewhere, setSelection, setPrompt, reload, ...inputs
}: Options) {
  const repaint = () => {
    const request = repaintRequest(inputs);
    if (!focusedLayer || !request || busyElsewhere) return;
    if (myRepaint?.stage === 'failed') dismissEditorJob(); // clear the failed attempt before resubmitting
    void startRepaint(focusedLayer.id, songId, request);
  };

  // Runs once when *our* repaint finishes — the job itself may have completed while this
  // Editor was unmounted (e.g. user navigated to the Library and back to this song).
  useEffect(() => {
    if (myRepaint?.stage === 'done') {
      setSelection(null);
      setPrompt('');
      void reload();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myRepaint?.stage]);

  return repaint;
}
