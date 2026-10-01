import { useGenerationStore } from './generationStore';
import { isGenerating } from './generationJob';
import { useEditorJobStore, myEditorJob, isEditorBusy, selectSplitRunning } from './editorJobStore';

/** The focused layer's repaint job status, and whether the global lock is held elsewhere. */
export function useEditorRepaintJob(focusedLayerId: string | null) {
  const genRunning = useGenerationStore((s) => isGenerating(s.job));
  const otherLock = useGenerationStore((s) => s.otherLock);
  const editorJob = useEditorJobStore((s) => s.editorJob);
  const splitRunning = useEditorJobStore(selectSplitRunning);
  const startRepaint = useEditorJobStore((s) => s.startRepaint);
  const dismissEditorJob = useEditorJobStore((s) => s.dismiss);
  // The repaint job belonging to *this* layer, if any — survives navigating away and back
  // (editorJobStore.ts lives outside React, so it isn't reset when Editor unmounts).
  const myRepaint = myEditorJob(editorJob, 'repaint', { layerId: focusedLayerId ?? undefined });
  const job: 'idle' | 'running' = myRepaint?.stage === 'running' ? 'running' : 'idle';
  const startedAt = myRepaint?.startedAt ?? null;
  const error = myRepaint?.stage === 'failed' ? (myRepaint.error ?? 'repaint failed') : '';
  // A song generating in the Library, a *different* editor action or a split extracting all
  // hold the same global lock (see server genLock.ts) — any one blocks repaint here too.
  const busyElsewhere = splitRunning || (!myRepaint && (genRunning || isEditorBusy(editorJob) || !!otherLock));
  return { startRepaint, dismissEditorJob, myRepaint, job, startedAt, error, busyElsewhere };
}
