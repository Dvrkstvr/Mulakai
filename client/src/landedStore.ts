import { create } from 'zustand';

/** A Create take that just landed: the song the create bar's LANDED card opens (PLAN.md "The other screens"). */
export interface Landed {
  songId: string;
  title: string;
}

interface LandedState {
  landed: Landed | null;
  /** A newer take replaces the one shown. */
  land: (l: Landed) => void;
  /** ✕, or one of the card's buttons was used. */
  dismiss: () => void;
}

export const useLandedStore = create<LandedState>((set) => ({
  landed: null,
  land: (landed) => set({ landed }),
  dismiss: () => set({ landed: null }),
}));
