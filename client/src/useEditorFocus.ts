import { useEffect, type Dispatch, type SetStateAction } from 'react';
import type { SongDetail } from './api';
import { useEditorJobStore } from './editorJobStore';
import type { RailMode } from './EditorRail';

/** Picks the Editor's focused layer and rail when a song (re)loads. */
export function useEditorFocus(
  song: SongDetail | null,
  focusedLayerId: string | null,
  setFocusedLayerId: Dispatch<SetStateAction<string | null>>,
  setRailMode: Dispatch<SetStateAction<RailMode>>,
) {
  // Default focus to the base layer once the song loads; keep focus if the layer still exists.
  useEffect(() => {
    if (!song) return;
    if (focusedLayerId && song.layers.some((l) => l.id === focusedLayerId)) return;
    setFocusedLayerId(song.layers.find((l) => l.kind === 'base')?.id ?? song.layers[0]?.id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [song, focusedLayerId]);

  // If this song already has a remaster running or a split open (e.g. the user left mid-job and
  // came back), jump straight to the rail that shows it instead of defaulting to History — otherwise
  // the job is invisibly still there behind a rail the user isn't looking at. Runs once per song
  // load, not on every job tick (hence getState), so manually switching rails afterward sticks.
  useEffect(() => {
    const { editorJob: job, splitJob } = useEditorJobStore.getState();
    if (song && job?.songId === song.id && job.kind === 'remaster') setRailMode('export');
    else if (song && splitJob?.songId === song.id) { setRailMode('split'); setFocusedLayerId(splitJob.layerId); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [song?.id]);
}
