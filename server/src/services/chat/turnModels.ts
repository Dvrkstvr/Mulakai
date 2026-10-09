/**
 * The models one chat turn asks, one at a time inside its one `plan` slot (D-233, LD): the planner, then
 * the lyrics model a recipe's language names. Before a call on another model than the last one, that
 * one is unloaded and `/api/ps` read empty (the release); a model is probed (pulled?) before its first
 * call, and one that is not fails the turn with `run 'ollama pull <model>'` (F-049). `releaseAll` unloads
 * every model the turn touched and waits for `/api/ps` empty: turnJob's `finally`, before the slot is
 * released. Same model (en / es: lyrics on the planner) = no unload between, one release. A call the turn gave up
 * on (timeout, cancel: `call`) may still be generating, so every later release waits longer for it (F-095). Ollama control
 * is injected (ollamaControl in production, fakes in tests).
 */
import type { CutCall, LoadedModel } from '../score/ollamaControl.js';
import { CallCut } from '../score/plannerClient.js';
import { TurnError } from './turnOutcome.js';

export interface ModelControl {
  /** Null when `model` can be asked; else why not (not pulled, offline). */
  probe: (model: string) => Promise<string | null>;
  loaded: () => Promise<LoadedModel[]>;
  /** Unload these models, then wait for `/api/ps` empty; throws naming a model still listed after the bound.
   * `cut`: a call the turn gave up on, still maybe generating: the longer bound (F-095, D-259). */
  release: (models: string[], cut?: CutCall) => Promise<unknown>;
}

export interface ModelSession {
  /** Ready `model` for the next call: probe it the first time, unload the previous model when it differs. */
  use: (model: string, onUnload?: () => void) => Promise<void>;
  /** `model`'s context length as `/api/ps` lists it (null before it is loaded). */
  contextOf: (model: string) => Promise<number | null>;
  /** Runs one call on `model`; a timeout or cancel (CallCut) is remembered for every later release, then rethrown. */
  call: <T>(model: string, run: () => Promise<T>) => Promise<T>;
  touched: () => string[];
  releaseAll: () => Promise<unknown>;
}

/** `gemma4:26b-a4b-it-q4_K_M` -> `gemma4`: the progress line's name. */
export const shortModel = (model: string): string => model.split(':')[0];

/** `first`: the planner, already probed by the caller and loaded by its first call. */
export function modelSession(ctl: ModelControl, first: string): ModelSession {
  const touched = [first];
  const probed = new Set([first]);
  let current = first;
  let cut: CutCall | undefined;
  return {
    async use(model, onUnload) {
      if (!probed.has(model)) {
        const why = await ctl.probe(model);
        if (why) throw new TurnError('check', why); // a failed turn, not ASSISTANT OFF: the planner itself answers
        probed.add(model);
      }
      if (model === current) return;
      onUnload?.();
      await ctl.release([current], cut);
      current = model;
      if (!touched.includes(model)) touched.push(model);
    },
    contextOf: async (model) => (await ctl.loaded()).find((m) => m.name === model)?.contextLength ?? null,
    async call(model, run) {
      try {
        return await run();
      } catch (err) {
        if (err instanceof CallCut) cut = { model: err.model || model, why: err.why };
        throw err;
      }
    },
    touched: () => [...touched],
    releaseAll: () => ctl.release([...touched], cut),
  };
}
