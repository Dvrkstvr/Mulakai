import { useEffect } from 'react';
import type { Layer } from './api';
import type { Region } from './Waveform';
import { repaintParams, type RepaintSettings } from './settings';
import { clampCrossfade, repaintRangeValid } from './repaintLimits';
import { repaintFieldsUnchanged } from './landedFields';
import type { useEditorRepaintJob } from './useEditorRepaintJob';

type RepaintJob = Pick<ReturnType<typeof useEditorRepaintJob>, 'startRepaint' | 'dismiss' | 'failed' | 'landedJobs' | 'landed'>;

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

/** Submits the Editor's repaint of the selected range — queued behind whatever runs, never
 * refused for a busy GPU — and, once one lands, clears the range and instruction only if they
 * still hold what it was submitted with (the Editor reloads the song itself, useLandedReload). */
export function useRepaintSubmit({
  songId, focusedLayer, startRepaint, dismiss, failed, landedJobs, landed, setSelection, setPrompt, ...inputs
}: Options) {
  const repaint = () => {
    const request = repaintRequest(inputs);
    if (!focusedLayer || !request) return;
    if (failed) dismiss(failed.key); // the new attempt replaces the failed one's error line
    void startRepaint(focusedLayer.id, songId, request);
  };

  // A repaint may have landed while this Editor was unmounted (it lingers as done). A range or
  // instruction set up after committing it is the user's next edit, and stays.
  useEffect(() => {
    const { selection, prompt } = inputs;
    if (landedJobs.some((j) => j.kind === 'repaint' && repaintFieldsUnchanged(j.submitted, selection, prompt))) {
      setSelection(null);
      setPrompt('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [landed]);

  return repaint;
}
