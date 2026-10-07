/** Test-only stand-in for `zustand`'s `create` (`vi.mock('zustand', () => import('./zustandServerSnapshot'))`):
 * server rendering (`renderToStaticMarkup`, the client tests' renderer) reads a store's *initial* state, so a
 * component test could never see the state it set. Here the server snapshot is the current state. */
import { useSyncExternalStore } from 'react';
import { createStore, type StateCreator } from 'zustand/vanilla';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function make(init: StateCreator<any>) {
  const api = createStore(init);
  const useBound = (sel: (s: unknown) => unknown = (s) => s) =>
    useSyncExternalStore(api.subscribe, () => sel(api.getState()), () => sel(api.getState()));
  return Object.assign(useBound, api);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const create = (init?: StateCreator<any>) => (init ? make(init) : make);
