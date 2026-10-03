/** Wires the owning stores' transitions into activityStore (PLAN.md "UI Redesign", S3.5).
 * Started once by App; returns the unsubscribe. */
import { api } from './api';
import { useActivityStore, type ActivityEntry } from './activityStore';
import { editorSettled, genSettled, localSettled, splitSettled, timingsFailed } from './activitySettle';
import { useEditorJobStore } from './editorJobStore';
import { useGenerationStore } from './generationStore';
import { useReadLyricsStore } from './readLyricsStore';
import { useSongIndexStore } from './songIndexStore';
import { useTimingsStore } from './timingsStore';
import { useTranscribeStore } from './transcribeStore';

function record(entry: ActivityEntry | null): void {
  if (!entry) return;
  const activity = useActivityStore.getState();
  activity.record(entry);
  if (entry.status !== 'done') return;
  void useSongIndexStore.getState().load(); // a new song, or a title the Activity row needs
  if (entry.layerId && entry.songId) {
    const { layerId } = entry;
    api.songDetail(entry.songId)
      .then((song) => {
        const layer = song.layers.find((l) => l.id === layerId);
        if (layer) useActivityStore.getState().patch(entry.id, { badge: `${layer.name.toUpperCase()} v${layer.versions.length}` });
      })
      .catch(() => {}); // the plain badge stays
  }
}

export function trackActivity(): () => void {
  const unsubs = [
    useGenerationStore.subscribe((s, prev) => record(genSettled(prev.job, s.job))),
    useEditorJobStore.subscribe((s, prev) => {
      record(editorSettled(prev.editorJob, s.editorJob));
      record(splitSettled(prev.splitJob, s.splitJob));
    }),
    useTranscribeStore.subscribe((s, prev) => record(localSettled('transcribe', prev, s, () => void s.retry()))),
    useReadLyricsStore.subscribe((s, prev) => record(localSettled('lyrics', prev, s, () => void s.retry()))),
    useTimingsStore.subscribe((s, prev) => {
      if (s.runs === prev.runs) return;
      timingsFailed(prev.runs, s.runs, (versionId) => {
        const timings = useTimingsStore.getState();
        timings.retry(versionId);
        void timings.read(versionId);
      }).forEach(record);
    }),
  ];
  return () => unsubs.forEach((u) => u());
}
