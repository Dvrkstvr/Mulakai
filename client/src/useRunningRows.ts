import { useMemo } from 'react';
import { runningRows, type RunningRow } from './activityRunning';
import { useApiStatusStore } from './apiStatusStore';
import { useEditorJobStore } from './editorJobStore';
import { useGenerationStore } from './generationStore';
import { isEngineStage } from './genProgress';
import { useReadLyricsStore } from './readLyricsStore';
import { useTimingsStore } from './timingsStore';
import { useTranscribeStore } from './transcribeStore';

/** Activity's RUNNING rows, live. */
export function useRunningRows(): RunningRow[] {
  const genJob = useGenerationStore((s) => s.job);
  const editorJob = useEditorJobStore((s) => s.editorJob);
  const splitJob = useEditorJobStore((s) => s.splitJob);
  const transcribeStage = useTranscribeStore((s) => s.stage);
  const transcribeProgress = useTranscribeStore((s) => s.progress);
  const readLyricsStage = useReadLyricsStore((s) => s.stage);
  const timings = useTimingsStore((s) => s.runs);
  const active = useApiStatusStore((s) => s.active);
  return useMemo(() => runningRows({
    genJob, editorJob, splitJob, timings, active,
    transcribe: { stage: transcribeStage, progress: transcribeProgress },
    readLyrics: { stage: readLyricsStage },
  }, isEngineStage), [genJob, editorJob, splitJob, timings, active, transcribeStage, transcribeProgress, readLyricsStage]);
}
