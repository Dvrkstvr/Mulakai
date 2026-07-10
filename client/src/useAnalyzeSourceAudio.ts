import { useEffect, useRef, useState } from 'react';
import { api, type RefineResult, type StemKind } from './api';

export type AnalyzeSource =
  | { kind: 'file'; key: string; resolve: () => Promise<Blob> }
  | { kind: 'scratch'; jobId: string; stemKind: StemKind }
  | null;

export interface AnalyzeState {
  analyzing: boolean;
  error: string;
  result: RefineResult | null;
}

const IDLE: AnalyzeState = { analyzing: false, error: '', result: null };

/** Identity string for a source selection, used to dedupe: "one analyze call per
 * distinct source" regardless of how many times the surrounding component re-renders. */
export function sourceKey(source: AnalyzeSource): string | null {
  if (!source) return null;
  return source.kind === 'file' ? `file:${source.key}` : `scratch:${source.jobId}:${source.stemKind}`;
}

/** Pure trigger decision: fire only for a source not already analyzed (`firedKey`), and
 * only while the prompt is still empty — never auto-overwrite something the user typed. */
export function shouldAnalyze(source: AnalyzeSource, prompt: string, firedKey: string | null): boolean {
  const key = sourceKey(source);
  return key !== null && key !== firedKey && prompt.trim() === '';
}

/** Auto-fires ACE-Step's `/v1/analyze_audio` once per distinct source selection when the
 * prompt is empty. Shared by CreateAudioTab and CreateArrangeTab so both auto-fill
 * caption/lyrics/bpm/key/duration the same way. */
export function useAnalyzeSourceAudio(source: AnalyzeSource, prompt: string): AnalyzeState {
  const [state, setState] = useState<AnalyzeState>(IDLE);
  const firedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!shouldAnalyze(source, prompt, firedKeyRef.current)) return;
    firedKeyRef.current = sourceKey(source);
    let cancelled = false;
    setState({ analyzing: true, error: '', result: null });
    (async () => {
      try {
        const input = source!.kind === 'file'
          ? { file: await source!.resolve() }
          : { scratchJobId: source!.jobId, scratchStemKind: source!.stemKind };
        const result = await api.analyzeSourceAudio(input);
        if (!cancelled) setState({ analyzing: false, error: '', result });
      } catch (err) {
        if (!cancelled) setState({ analyzing: false, error: err instanceof Error ? err.message : String(err), result: null });
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, prompt]);

  return state;
}

/** `useAnalyzeSourceAudio` plus the "apply the result to form state" step every caller needs —
 * only fills fields that are still empty/AUTO, so it never clobbers a hand-edited value that
 * happened to get set between analysis starting and finishing. */
export function useAnalyzeAndApply(
  source: AnalyzeSource,
  prompt: string,
  lyrics: string,
  setters: {
    setPrompt: (v: string) => void;
    setLyrics: (v: string) => void;
    setBpm: (v: number) => void;
    setKeyScale: (v: string) => void;
    setDuration: (v: number) => void;
  },
): AnalyzeState {
  const state = useAnalyzeSourceAudio(source, prompt);
  useEffect(() => {
    if (!state.result) return;
    const r = state.result;
    if (!prompt) setters.setPrompt(r.caption);
    if (!lyrics) setters.setLyrics(r.lyrics);
    if (r.bpm) setters.setBpm(r.bpm);
    if (r.key_scale) setters.setKeyScale(r.key_scale);
    if (r.duration) setters.setDuration(r.duration);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.result]);
  return state;
}
