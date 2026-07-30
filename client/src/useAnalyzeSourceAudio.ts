import { useCallback, useEffect, useRef, useState } from 'react';
import { api, type RefineResult, type StemKind } from './api';

export type AnalyzeSource =
  | { kind: 'file'; resolve: () => Promise<Blob> }
  | { kind: 'scratch'; jobId: string; stemKind: StemKind }
  | null;

export interface AnalyzeState {
  analyzing: boolean;
  error: string;
  result: RefineResult | null;
}

const IDLE: AnalyzeState = { analyzing: false, error: '', result: null };

/** Whether the ANALYZE AUDIO button should be enabled: a source is picked, a model is
 * selected (analysis loads it via `/v1/init` before analyzing — see `analyzeAudio` in
 * server/src/services/acestep.ts), and nothing else is already busy. */
export function canAnalyze(source: AnalyzeSource, model: string, busy: boolean): boolean {
  return !!source && !!model && !busy;
}

/** Whether an analysis result may write over a text field: it's empty, or it holds text carried
 * in from another Create tab (createDraftStore's intentOrigin), where it described something
 * else. Refusing to fill because a foreign prompt happens to be sitting there is the surprise
 * this avoids; a prompt written in *this* tab is the user's and stays put. */
export function fillable(value: string, carried?: boolean): boolean {
  return !value || !!carried;
}

/** Manually-triggered "analyze this source audio" call — `analyze()` loads the given model
 * (+ its LM) then runs ACE-Step's `/v1/analyze_audio`. Shared by CreateAudioTab and
 * CreateArrangeTab via `AnalyzeAudioButton`. A request-token ref guards against a stale
 * in-flight response clobbering state if the source/model changes mid-request. */
export function useAnalyzeSourceAudio(): AnalyzeState & { analyze: (source: AnalyzeSource, model: string) => void } {
  const [state, setState] = useState<AnalyzeState>(IDLE);
  const tokenRef = useRef(0);

  const analyze = useCallback((source: AnalyzeSource, model: string) => {
    if (!source) return;
    const token = ++tokenRef.current;
    setState({ analyzing: true, error: '', result: null });
    (async () => {
      try {
        const input = source.kind === 'file'
          ? { file: await source.resolve() }
          : { scratchJobId: source.jobId, scratchStemKind: source.stemKind };
        const result = await api.analyzeSourceAudio(input, model);
        if (tokenRef.current === token) setState({ analyzing: false, error: '', result });
      } catch (err) {
        if (tokenRef.current === token) {
          setState({ analyzing: false, error: err instanceof Error ? err.message : String(err), result: null });
        }
      }
    })();
  }, []);

  return { ...state, analyze };
}

/** `useAnalyzeSourceAudio` plus the "apply the result to form state" step every caller needs —
 * only fills fields that are still empty/AUTO, so it never clobbers a hand-edited value that
 * happened to get set between analysis starting and finishing.
 *
 * `carried` marks prompt/lyrics that were written in a different Create tab and came along
 * with the shared draft (createDraftStore's intentOrigin). Those count as fillable: text
 * written for a from-scratch song means something else here, and refusing to fill because a
 * foreign prompt happens to be sitting in the field is exactly the surprise to avoid. */
export function useAnalyzeAndApply(
  prompt: string,
  lyrics: string,
  setters: {
    setPrompt: (v: string) => void;
    setLyrics: (v: string) => void;
    setBpm: (v: number) => void;
    setKeyScale: (v: string) => void;
    setDuration: (v: number) => void;
  },
  opts?: { carried?: boolean },
): AnalyzeState & { analyze: (source: AnalyzeSource, model: string) => void } {
  const state = useAnalyzeSourceAudio();
  useEffect(() => {
    if (!state.result) return;
    const r = state.result;
    if (fillable(prompt, opts?.carried)) setters.setPrompt(r.caption);
    if (fillable(lyrics, opts?.carried)) setters.setLyrics(r.lyrics);
    if (r.bpm) setters.setBpm(r.bpm);
    if (r.key_scale) setters.setKeyScale(r.key_scale);
    if (r.duration) setters.setDuration(r.duration);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.result]);
  return state;
}
