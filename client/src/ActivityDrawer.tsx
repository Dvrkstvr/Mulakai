import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useActivityStore, type ActivityEntry } from './activityStore';
import { useCommandStore } from './commandStore';
import type { CreateDraft } from './createDraft';
import { useGenerationStore } from './generationStore';
import { songTitle, useSongIndexStore } from './songIndexStore';
import { useRunningRows } from './useRunningRows';
import { RunningActivityRow, SettledActivityRow } from './ActivityRow';
import { RETRY_BUSY, retryEntry } from './activityRetry';
import { useQueueStore } from './queueStore';
import { QueuedActivityRow } from './QueuedActivityRow';

interface Props {
  openEditor: (songId: string) => void;
  /** Create as it is: where TRANSCRIBE and READ LYRICS left their results. */
  openCreate: () => void;
  /** A failed generation's RETRY: Create, reopened on the draft that made it. */
  retryGeneration: (draft: CreateDraft) => void;
}

/** ACTIVITY (PLAN.md "UI Redesign", S3.5): a right-edge panel over the content, not a modal, so
 * the canvas stays live. ESC or the header button closes it. */
export function ActivityDrawer(props: Props) {
  const open = useActivityStore((s) => s.drawerOpen);
  return <AnimatePresence>{open && <Drawer {...props} />}</AnimatePresence>;
}

function Drawer({ openEditor, openCreate, retryGeneration }: Props) {
  const entries = useActivityStore((s) => s.entries);
  const { setDrawerOpen, clear, remove, patch } = useActivityStore.getState();
  const songs = useSongIndexStore((s) => s.songs);
  const running = useRunningRows();
  const queued = useQueueStore((s) => s.queued);
  const queueError = useQueueStore((s) => s.error);
  const close = () => setDrawerOpen(false);

  useEffect(() => { void useSongIndexStore.getState().load(); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || useCommandStore.getState().open) return;
      useActivityStore.getState().setDrawerOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const opener = (e: ActivityEntry) => {
    if (e.opens === 'editor' && e.songId) {
      const songId = e.songId;
      return () => { close(); openEditor(songId); };
    }
    return e.opens === 'create' ? () => { close(); openCreate(); } : undefined;
  };
  const retrier = (e: ActivityEntry) => {
    // The row goes only once the job has really started again; a refused RETRY says why.
    if (e.retry) {
      return () => {
        if (retryEntry(e) === 'started') remove(e.id);
        else patch(e.id, { note: RETRY_BUSY });
      };
    }
    if (!e.draft) return undefined;
    const draft = e.draft;
    return () => {
      remove(e.id);
      if (e.jobKey) useGenerationStore.getState().dismiss(e.jobKey);
      close();
      retryGeneration(draft);
    };
  };

  const done = entries.filter((e) => e.status === 'done');
  const failed = entries.filter((e) => e.status === 'failed');
  const title = (songId?: string) => songTitle(songs, songId);

  return (
    <motion.aside
      id="activity-drawer" className="activity-drawer" aria-label="Activity"
      initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 24 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
    >
      <div className="activity-head">
        <span className="activity-heading">ACTIVITY</span>
        <button type="button" className="activity-link" disabled={entries.length === 0} onClick={clear}>CLEAR DONE</button>
        <button type="button" className="activity-link" aria-label="Close activity" onClick={close}>✕</button>
      </div>
      {running.length > 0 && <span className="activity-section">RUNNING</span>}
      {running.map((r) => <RunningActivityRow key={r.key} row={r} title={r.title ?? title(r.songId)} />)}
      {queued.length > 0 && <span className="activity-section">UP NEXT</span>}
      {queued.map((q) => <QueuedActivityRow key={q.jobId} entry={q} songTitle={title(q.songId)} />)}
      {queueError && <span className="activity-note">{queueError}</span>}
      {done.length > 0 && <span className="activity-section">DONE</span>}
      {done.map((e) => <SettledActivityRow key={e.id} entry={e} title={title(e.songId)} onOpen={opener(e)} />)}
      {failed.length > 0 && <span className="activity-section">FAILED</span>}
      {failed.map((e) => <SettledActivityRow key={e.id} entry={e} title={title(e.songId)} onRetry={retrier(e)} />)}
      {running.length + queued.length + entries.length === 0 && (
        <div className="activity-empty">Nothing running, and nothing finished yet this session.</div>
      )}
    </motion.aside>
  );
}
