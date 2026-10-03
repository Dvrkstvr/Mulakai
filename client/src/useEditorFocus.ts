import { useEffect, type Dispatch, type SetStateAction } from 'react';
import type { SongDetail } from './api';
import { useEditorJobStore } from './editorJobStore';
import type { DockVerb } from './dockTarget';

/** Picks the Editor's focused layer and dock verb when a song (re)loads. */
export function useEditorFocus(
  song: SongDetail | null,
  focusedLayerId: string | null,
  setFocusedLayerId: Dispatch<SetStateAction<string | null>>,
  setVerb: (verb: DockVerb) => void,
) {
  // Default focus to the base layer once the song loads; keep focus if the layer still exists.
  useEffect(() => {
    if (!song) return;
    if (focusedLayerId && song.layers.some((l) => l.id === focusedLayerId)) return;
    setFocusedLayerId(song.layers.find((l) => l.kind === 'base')?.id ?? song.layers[0]?.id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [song, focusedLayerId]);

  // If this song already has a remaster running or a split open (e.g. the user left mid-job and
  // came back), open the verb that shows it instead of defaulting to REPAINT — otherwise the job
  // is invisibly still there behind a verb the user isn't looking at. Runs once per song load,
  // not on every job tick (hence getState), so switching verbs afterward sticks.
  useEffect(() => {
    const { editorJob: job, splitJob } = useEditorJobStore.getState();
    if (song && job?.songId === song.id && job.kind === 'remaster') setVerb('export');
    else if (song && splitJob?.songId === song.id) { setVerb('split'); setFocusedLayerId(splitJob.layerId); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [song?.id]);
}
