import { useEditorJobStore, myEditorJobs, jobView } from './editorJobStore';

/** The focused layer's repaint jobs: those in flight (several may wait in the queue), the one
 * the GPU is working on, the newest failure and which have landed. They live outside React
 * (editorJobStore.ts), so they survive leaving the Editor and coming back. */
export function useEditorRepaintJob(focusedLayerId: string | null) {
  const editorJobs = useEditorJobStore((s) => s.editorJobs);
  const startRepaint = useEditorJobStore((s) => s.startRepaint);
  const dismiss = useEditorJobStore((s) => s.dismiss);
  const view = jobView(focusedLayerId ? myEditorJobs(editorJobs, 'repaint', { layerId: focusedLayerId }) : []);
  const error = view.failed ? (view.failed.error ?? 'repaint failed') : '';
  return { startRepaint, dismiss, ...view, error };
}
