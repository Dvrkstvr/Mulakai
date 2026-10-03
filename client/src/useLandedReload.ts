import { useEffect } from 'react';
import { useEditorJobStore } from './editorJobStore';

/** The kinds whose result is a new version or lane of the open song. */
const SONG_EDITS = new Set(['repaint', 'regenerate', 'retake', 'addLayer']);

/** Which of this song's edits have landed, as one comparable string. Pure. */
export function landedEdits(jobs: { key: string; kind: string; songId: string; stage: string }[], songId: string): string {
  return jobs.filter((j) => j.songId === songId && SONG_EDITS.has(j.kind) && j.stage === 'done').map((j) => j.key).join(',');
}

/** Reloads the Editor's song whenever one of its edits lands — whichever layer, verb or view
 * started it, and even if it settled while the Editor wasn't mounted (the done job lingers). */
export function useLandedReload(songId: string, reload: () => Promise<void>): void {
  const landed = useEditorJobStore((s) => landedEdits(s.editorJobs, songId));
  useEffect(() => {
    if (landed) void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [landed]);
}
