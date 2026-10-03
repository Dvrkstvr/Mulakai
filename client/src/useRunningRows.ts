import { useMemo } from 'react';
import { runningRows, type RunningRow } from './activityRunning';
import { useApiStatusStore } from './apiStatusStore';
import { useEditorJobStore } from './editorJobStore';
import { useGenerationStore } from './generationStore';
import { isEngineStage } from './genProgress';
import { useReadLyricsStore } from './readLyricsStore';
import { useTimingsStore } from './timingsStore';
import { useTranscribeStore } from './transcribeStore';
import { useQueueStore } from './queueStore';
import { useActivityStore } from './activityStore';

/** Activity's RUNNING rows, live. */
export function useRunningRows(): RunningRow[] {
  const genJobs = useGenerationStore((s) => s.jobs);
  const editorJobs = useEditorJobStore((s) => s.editorJobs);
  const splitJob = useEditorJobStore((s) => s.splitJob);
  const transcribeStage = useTranscribeStore((s) => s.stage);
  const transcribeProgress = useTranscribeStore((s) => s.progress);
  const transcribeJob = useTranscribeStore((s) => s.jobId);
  const readLyricsStage = useReadLyricsStore((s) => s.stage);
  const readLyricsJob = useReadLyricsStore((s) => s.jobId);
  const timings = useTimingsStore((s) => s.runs);
  const active = useApiStatusStore((s) => s.active);
  const queued = useQueueStore((s) => s.queued);
  const entries = useActivityStore((s) => s.entries);
  return useMemo(() => runningRows({
    genJobs, editorJobs, splitJob, timings, active,
    transcribe: { stage: transcribeStage, progress: transcribeProgress, jobId: transcribeJob },
    readLyrics: { stage: readLyricsStage, jobId: readLyricsJob },
    queuedIds: new Set(queued.map((q) => q.jobId)),
    settledIds: new Set(entries.flatMap((e) => (e.jobId ? [e.jobId] : []))),
  }, isEngineStage), [
    genJobs, editorJobs, splitJob, timings, active, transcribeStage, transcribeProgress, transcribeJob,
    readLyricsStage, readLyricsJob, queued, entries,
  ]);
}
