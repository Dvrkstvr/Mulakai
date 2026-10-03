import { useEffect, useMemo } from 'react';
import type { SongDetail, Version, WordTimings } from './api';
import { alignLyrics, tokenize, type LyricAlignment } from './lyricAlign';
import { groupSections, type Section } from './lyricSections';
import { sectionTimings } from './timedSections';
import { useTimingsStore, shouldAutoRead } from './timingsStore';
import { useGenerationStore } from './generationStore';
import { isGenerating } from './generationJob';
import { useEditorJobStore, isEditorBusy, selectSplitRunning } from './editorJobStore';
import { useQueueStore } from './queueStore';

export interface LyricTiming {
  sections: Section[];
  /** The base version's reading aligned to the song's stored LYRICS, once read. */
  alignment: LyricAlignment | null;
  /** The base version's reading itself, for aligning the draft's lines. */
  timings: WordTimings | null;
  status: 'idle' | 'reading' | 'failed';
  error?: string;
  retry: () => void;
}

/**
 * The Editor's lyric timing (PLAN.md "Editor Word Timestamps"): reads the base layer's active
 * version once, automatically, while the lock is free, and builds the section strip from the
 * reading or ACE-Step's stored timings. Sections align the stored LYRICS, not the draft, so
 * typing in an unlocked section can't move the section it is editing.
 */
export function useLyricTiming(
  song: SongDetail | null, baseActive: Version | undefined, duration: number, reload: () => void,
): LyricTiming {
  const configured = useTimingsStore((s) => s.configured);
  const versionId = baseActive?.id;
  const run = useTimingsStore((s) => (versionId ? s.runs[versionId] : undefined));
  // The automatic read waits for an idle GPU rather than queueing ahead of the user's own edits.
  const genBusy = useGenerationStore((s) => s.jobs.some(isGenerating) || !!s.otherLock);
  const editorBusy = useEditorJobStore((s) => s.editorJobs.some(isEditorBusy) || selectSplitRunning(s));
  const queueBusy = useQueueStore((s) => !!s.running || s.queued.length > 0);
  const lockFree = !genBusy && !editorBusy && !queueBusy;
  const lyrics = song?.lyrics ?? '';
  const timings = baseActive?.wordTimings ?? null;
  const hasWords = useMemo(() => tokenize(lyrics).length > 0, [lyrics]);

  useEffect(() => { void useTimingsStore.getState().checkConfigured(); }, []);

  useEffect(() => {
    if (versionId && shouldAutoRead({ configured, versionId, hasTimings: !!timings, hasWords, run, lockFree })) {
      void useTimingsStore.getState().read(versionId);
    }
  }, [configured, versionId, timings, hasWords, run, lockFree]);

  // The read saved its result on the server; the song detail is what carries it here.
  useEffect(() => {
    if (run?.stage === 'done' && !timings) reload();
  }, [run?.stage, timings, reload]);

  const alignment = useMemo(() => (timings ? alignLyrics(lyrics, timings) : null), [lyrics, timings]);
  const sections = useMemo(
    () => groupSections(sectionTimings(baseActive?.lyricTimestamps, lyrics, alignment, duration), duration),
    [baseActive?.lyricTimestamps, lyrics, alignment, duration],
  );
  return {
    sections,
    alignment,
    timings,
    status: run?.stage === 'running' ? 'reading' : run?.stage === 'failed' ? 'failed' : 'idle',
    error: run?.error,
    retry: () => { if (versionId) useTimingsStore.getState().retry(versionId); },
  };
}
