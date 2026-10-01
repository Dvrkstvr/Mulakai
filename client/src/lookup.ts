import { useEffect, useMemo, useRef, useState } from 'react';
import { api, type SplitHealth, type TaskType } from './api';
import { errorText } from './actionError';

/** A read a control gates on (which models, which split backends, which voices).
 * `data` is null while loading and after a failure; `error` is the failure's "why". */
export interface Lookup<T> {
  data: T | null;
  error: string;
}

/**
 * Runs a lookup that never rejects: back to loading, then the answer or the error.
 * A failure never stands in for an answer, so a control says "couldn't check" rather
 * than "no model supports…" when the server simply wasn't reached.
 */
export function lookupRunner<T>(load: () => Promise<T>, set: (state: Lookup<T>) => void): () => Promise<void> {
  return () => {
    set({ data: null, error: '' });
    return Promise.resolve().then(load).then(
      (data) => set({ data, error: '' }),
      (err: unknown) => set({ data: null, error: errorText(err) }),
    );
  };
}

/** Runs `load` once on mount; `retry` runs it again (see lookupRunner). */
export function useLookup<T>(load: () => Promise<T>): Lookup<T> & { retry: () => void } {
  const [state, setState] = useState<Lookup<T>>({ data: null, error: '' });
  const loadRef = useRef(load);
  loadRef.current = load;
  const run = useMemo(() => lookupRunner(() => loadRef.current(), setState), []);
  useEffect(() => { void run(); }, [run]);
  return { ...state, retry: () => void run() };
}

/** Names of the downloaded models that support `task`; [] means the server answered "none". */
export const modelsFor = (task: TaskType): Promise<string[]> =>
  api.listModels().then((inv) => inv.models.filter((m) => m.supportedTaskTypes.includes(task)).map((m) => m.name));

/** The title on a disabled split-backend button: which of its "can't"s the server reported. */
export function splitBackendTitle(health: SplitHealth, backend: 'acestep' | 'demucs'): string | undefined {
  if (health[backend]) return undefined;
  if (backend === 'acestep') {
    return health.acestepError ? "couldn't check ACE-Step" : 'no downloaded model supports extract — requires a Base model';
  }
  return health.demucsReason === 'unreachable'
    ? 'Demucs is not answering at DEMUCS_API_URL'
    : 'Demucs is not configured (DEMUCS_API_URL unset)';
}
