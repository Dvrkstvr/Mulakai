import { useEffect, type Dispatch, type SetStateAction } from 'react';
import type { SongDetail } from './api';
import { useEditorJobStore } from './editorJobStore';
import type { DockVerb } from './dockTarget';
import { jobFocus, songBadgeJob } from './dockJobLine';

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

  // If this song has a job in flight or a split open (the user left mid-job and came back, or clicked
  // the Library row's badge), open the verb and layer that show it — the same job the badge names —
  // instead of defaulting to REPAINT on the base, where the job would sit invisibly. Runs once per
  // song load, not on every job tick (hence getState), so switching verbs afterward sticks.
  useEffect(() => {
    if (!song) return;
    const { editorJobs, splitJob } = useEditorJobStore.getState();
    const job = songBadgeJob(editorJobs, splitJob, song.id);
    if (!job) return;
    const focus = jobFocus(job);
    setVerb(focus.verb);
    if (focus.layerId && song.layers.some((l) => l.id === focus.layerId)) setFocusedLayerId(focus.layerId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [song?.id]);
}
