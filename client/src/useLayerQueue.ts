import { useEditorJobStore } from './editorJobStore';
import { pendingTakes } from './pendingTakes';
import { useQueueStore } from './queueStore';

/** The version a new take of `layer` will save: one past its history and every take of it
 * already on its way (PLAN.md "UI Redesign", S4.7). */
export function useNextVersion(layer: { id: string; name: string; versions: unknown[] } | undefined, songId: string): number {
  const jobs = useEditorJobStore((s) => s.editorJobs);
  const running = useQueueStore((s) => s.running);
  const queued = useQueueStore((s) => s.queued);
  if (!layer) return 1;
  return layer.versions.length + 1 + pendingTakes({ id: layer.id, name: layer.name, songId }, jobs, { running, queued });
}
