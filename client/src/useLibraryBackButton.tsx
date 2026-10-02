import { useMemo, useRef } from 'react';
import { useHeaderSlot } from './HeaderSlot';

/** Puts a "← LIBRARY" back button in the app header's left slot. */
export function useLibraryBackButton(onBack: () => void) {
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;
  const headerLeft = useMemo(() => <button onClick={() => onBackRef.current()}>← LIBRARY</button>, []);
  useHeaderSlot(headerLeft, null);
}
