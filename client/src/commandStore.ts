import { create } from 'zustand';

export type CommandGroup = 'DO' | 'OPEN' | 'CREATE' | 'SETTINGS';

/** One palette entry. `run` navigates or pre-fills; it never commits a generative or
 * destructive action (PLAN.md "UI Redesign", S3.1). */
export interface Command {
  id: string;
  group: CommandGroup;
  label: string;
  sub?: string;
  /** The key that runs the same thing outside the palette, shown as a hint. */
  key?: string;
  run: () => void;
}

interface CommandState {
  /** Items per publisher (`app`, `editor`, …), so a view clears only its own on unmount. */
  sources: Record<string, Command[]>;
  /** A view that narrows the palette to its own items (the Editor, named by its song). */
  scope: { source: string; label: string } | null;
  open: boolean;
  publish: (source: string, items: Command[], scopeLabel?: string) => void;
  clear: (source: string) => void;
  setOpen: (open: boolean) => void;
}

export const useCommandStore = create<CommandState>((set) => ({
  sources: {},
  scope: null,
  open: false,

  publish: (source, items, scopeLabel) => set((s) => ({
    sources: { ...s.sources, [source]: items },
    scope: scopeLabel ? { source, label: scopeLabel } : s.scope?.source === source ? null : s.scope,
  })),

  clear: (source) => set((s) => {
    const sources = { ...s.sources };
    delete sources[source];
    return { sources, scope: s.scope?.source === source ? null : s.scope };
  }),

  setOpen: (open) => set({ open }),
}));
