import { useEffect, useMemo, useRef, useState } from 'react';
import { api, type TaskType } from './api';
import { errorText } from './actionError';

/** A read a control gates on (which models, which split backends, which voices).
 * `data` is null while loading and after a failure; `error` is the failure's "why".
 * `slow` is set once a load has run past SLOW_LOOKUP_MS without an answer. */
export interface Lookup<T> {
  data: T | null;
  error: string;
  slow?: boolean;
}

/** ACE-Step answers nothing while it generates, so a model list can take minutes; past this
 * the control says why it's still waiting instead of looking stuck. */
export const SLOW_LOOKUP_MS = 15_000;
export const SLOW_ACESTEP_NOTE = 'ACE-Step is taking a while to answer, it may be busy generating';

/** The "checking…" line for a model lookup, with the slow note once it has run long. */
export const checkingModels = (lookup: Lookup<unknown>): string =>
  lookup.slow ? `checking available models… ${SLOW_ACESTEP_NOTE}` : 'checking available models…';

/**
 * Runs a lookup that never rejects: back to loading, then the answer or the error.
 * A failure never stands in for an answer, so a control says "couldn't check" rather
 * than "no model supports…" when the server simply wasn't reached.
 */
export function lookupRunner<T>(load: () => Promise<T>, set: (state: Lookup<T>) => void): () => Promise<void> {
  return () => {
    set({ data: null, error: '' });
    const slow = setTimeout(() => set({ data: null, error: '', slow: true }), SLOW_LOOKUP_MS);
    return Promise.resolve().then(load).then(
      (data) => set({ data, error: '' }),
      (err: unknown) => set({ data: null, error: errorText(err) }),
    ).finally(() => clearTimeout(slow));
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
