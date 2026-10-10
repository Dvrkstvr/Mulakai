import { useMemo, useRef, type ReactNode } from 'react';
import { useHeaderSlot } from './HeaderSlot';

/** Puts a "← LIBRARY" back button in the app header's left slot, and `right` (the Editor's EXPORT ▾) in its right one. */
export function useLibraryBackButton(onBack: () => void, right: ReactNode = null) {
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;
  const headerLeft = useMemo(() => <button onClick={() => onBackRef.current()}>← LIBRARY</button>, []);
  useHeaderSlot(headerLeft, right);
}
