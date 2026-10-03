import { useEffect } from 'react';
import { useCommandStore } from './commandStore';

/** Ctrl K (⌘K on a Mac) opens the command palette from anywhere, a text field included, and
 * closes it again. */
export function useCommandKey(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey || e.key.toLowerCase() !== 'k') return;
      e.preventDefault();
      const { open, setOpen } = useCommandStore.getState();
      setOpen(!open);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
