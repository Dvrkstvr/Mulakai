import { useEffect, useRef } from 'react';
import type { DockVerb } from './dockTarget';
import { BASE_VERBS, EXPORT_VERB, verbOfKey, type VerbSpec } from './dockVerbs';

const NON_TEXT_INPUTS = new Set(['range', 'checkbox', 'radio', 'button', 'submit', 'reset', 'color', 'file']);

/** Whether a keypress here is typing (a text field, a select, or an open dialog such as the palette). */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!target || typeof (target as Element).closest !== 'function') return false;
  const el = target as HTMLElement;
  if (el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable) return true;
  if (el.tagName === 'INPUT') return !NON_TEXT_INPUTS.has(((el as HTMLInputElement).type || 'text').toLowerCase());
  return !!el.closest('[role="dialog"], [role="listbox"], [role="combobox"]');
}

/** The verb a keydown picks among those on show, or null when it isn't a bare verb key (R/L/S/E,
 * and C while SCORE is on show) outside a text field. */
export function verbForKey(
  e: Pick<KeyboardEvent, 'key' | 'target' | 'ctrlKey' | 'metaKey' | 'altKey' | 'repeat'>, verbs: readonly VerbSpec[] = BASE_VERBS,
): DockVerb | null {
  if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return null;
  if (isTypingTarget(e.target)) return null;
  return verbOfKey([...verbs, EXPORT_VERB], e.key); // E opens the header's EXPORT menu
}

/** Escape outside a text field, a dialog or a menu that took it (preventDefault) closes the open action. */
export function closesAction(e: Pick<KeyboardEvent, 'key' | 'target' | 'defaultPrevented'>): boolean {
  return e.key === 'Escape' && !e.defaultPrevented && !isTypingTarget(e.target);
}

/** The verb keys open an action, Escape closes it (Space stays the transport's, see useSpaceTransport). */
export function useDockKeys(setVerb: (verb: DockVerb | null) => void, verbs: readonly VerbSpec[] = BASE_VERBS) {
  const setRef = useRef(setVerb);
  setRef.current = setVerb;
  const verbsRef = useRef(verbs);
  verbsRef.current = verbs;
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (closesAction(e)) { setRef.current(null); return; }
      const verb = verbForKey(e, verbsRef.current);
      if (!verb) return;
      e.preventDefault();
      setRef.current(verb);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
