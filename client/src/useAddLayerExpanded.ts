import { useCallback, useEffect, useRef, useState } from 'react';

/** Whether the Editor's Add Layer context (voice picker, lyrics editor) is expanded. */
export function useAddLayerExpanded() {
  const [addingLayerExpanded, setAddingLayerExpanded] = useState(false);
  // Debounced so moving the cursor from the trigger row across the gap to the rail
  // (to reach the voice picker it just revealed) doesn't collapse it mid-transit.
  const collapseTimer = useRef<number | null>(null);
  const requestAddingLayerExpanded = useCallback((next: boolean) => {
    if (collapseTimer.current !== null) { window.clearTimeout(collapseTimer.current); collapseTimer.current = null; }
    if (next) setAddingLayerExpanded(true);
    else collapseTimer.current = window.setTimeout(() => setAddingLayerExpanded(false), 500);
  }, []);
  useEffect(() => () => { if (collapseTimer.current !== null) window.clearTimeout(collapseTimer.current); }, []);
  return { addingLayerExpanded, requestAddingLayerExpanded };
}
