import { createContext, useContext, useEffect, type ReactNode } from 'react';

export const HeaderSlotContext = createContext<(left: ReactNode, right: ReactNode) => void>(() => {});

/** Publishes back-button (left) / title+meta (right) content into the persistent app header while mounted, clearing on unmount. */
export function useHeaderSlot(left: ReactNode, right: ReactNode) {
  const setSlot = useContext(HeaderSlotContext);
  useEffect(() => {
    setSlot(left, right);
    return () => setSlot(null, null);
  }, [setSlot, left, right]);
}
