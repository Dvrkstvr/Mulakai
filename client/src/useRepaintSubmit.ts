import { useEffect } from 'react';
import type { Layer } from './api';
import type { Region } from './Waveform';
import { repaintParams, type RepaintSettings } from './settings';
import { REPAINT_MIN_SECONDS, REPAINT_MAX_SECONDS } from './repaintLimits';
import type { useEditorRepaintJob } from './useEditorRepaintJob';

type RepaintJob = Pick<ReturnType<typeof useEditorRepaintJob>, 'startRepaint' | 'dismissEditorJob' | 'myRepaint' | 'busyElsewhere'>;

interface Options extends RepaintJob {
  songId: string;
  focusedLayer: Layer | undefined;
  selection: Region | null;
  prompt: string;
  lyricsUnlocked: boolean;
  lyricsDraft: string;
  repaintSettings: RepaintSettings;
  setSelection: (selection: Region | null) => void;
  setPrompt: (prompt: string) => void;
  reload: () => Promise<void>;
}

/** Submits the Editor's repaint of the selected region, and clears it once *our* repaint lands. */
export function useRepaintSubmit({
  songId, focusedLayer, selection, prompt, lyricsUnlocked, lyricsDraft, repaintSettings,
  startRepaint, dismissEditorJob, myRepaint, busyElsewhere, setSelection, setPrompt, reload,
}: Options) {
  const regionSeconds = selection ? selection.end - selection.start : 0;
  const regionValid = !!selection && regionSeconds >= REPAINT_MIN_SECONDS && regionSeconds <= REPAINT_MAX_SECONDS;

  const repaint = () => {
    if (!focusedLayer || !regionValid || !selection || busyElsewhere) return;
    if (myRepaint?.stage === 'failed') dismissEditorJob(); // clear the failed attempt before resubmitting
    void startRepaint(focusedLayer.id, songId, {
      prompt,
      start: selection.start,
      end: selection.end,
      ...(lyricsUnlocked ? { lyrics: lyricsDraft } : {}),
      ...repaintParams(repaintSettings),
    });
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
