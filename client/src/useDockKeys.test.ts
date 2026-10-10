import { describe, it, expect } from 'vitest';
import { closesAction, isTypingTarget, verbForKey } from './useDockKeys';
import { dockVerbs } from './dockVerbs';

/** Enough of an element for the guard: no DOM in this test environment. */
function el(tagName: string, opts: { type?: string; editable?: boolean; inDialog?: boolean } = {}) {
  return {
    tagName,
    type: opts.type,
    isContentEditable: !!opts.editable,
    closest: () => (opts.inDialog ? {} : null),
  } as unknown as EventTarget;
}

const key = (k: string, target: EventTarget | null, mods: Partial<KeyboardEvent> = {}) =>
  verbForKey({ key: k, target, ctrlKey: false, metaKey: false, altKey: false, repeat: false, ...mods });

describe('verbForKey', () => {
  it('maps R/L/S/E to the four verbs, either case', () => {
    expect(key('r', el('DIV'))).toBe('repaint');
    expect(key('L', el('DIV'))).toBe('addLayer');
    expect(key('s', el('BUTTON'))).toBe('split');
    expect(key('e', null)).toBe('export');
    expect(key('x', el('DIV'))).toBeNull();
    expect(key(' ', el('DIV'))).toBeNull();
  });

  it('ignores the keys while typing in a text field, a textarea or a select', () => {
    expect(key('r', el('INPUT'))).toBeNull();
    expect(key('r', el('INPUT', { type: 'number' }))).toBeNull();
    expect(key('r', el('TEXTAREA'))).toBeNull();
    expect(key('r', el('SELECT'))).toBeNull();
    expect(key('r', el('DIV', { editable: true }))).toBeNull();
  });

  it('ignores them inside a dialog (the palette) or a dropdown', () => {
    expect(key('r', el('BUTTON', { inDialog: true }))).toBeNull();
  });

  it('still switches from a slider or a checkbox, which take no letters', () => {
    expect(key('s', el('INPUT', { type: 'range' }))).toBe('split');
    expect(key('s', el('INPUT', { type: 'checkbox' }))).toBe('split');
  });

  it('leaves shortcuts with a modifier, and auto-repeat, alone', () => {
    expect(key('r', el('DIV'), { ctrlKey: true })).toBeNull();
    expect(key('e', el('DIV'), { metaKey: true })).toBeNull();
    expect(key('s', el('DIV'), { altKey: true })).toBeNull();
    expect(key('l', el('DIV'), { repeat: true })).toBeNull();
  });

  it('treats a non-element target as not typing', () => {
    expect(isTypingTarget({} as EventTarget)).toBe(false);
  });
});

describe('verbForKey with SCORE (F-021 #5)', () => {
  const press = (k: string, scoreShown: boolean, target: EventTarget | null = el('DIV')) =>
    verbForKey({ key: k, target, ctrlKey: false, metaKey: false, altKey: false, repeat: false }, dockVerbs(scoreShown));

  it('C opens SCORE only on a song that shows it; it does nothing on a four-verb song', () => {
    expect(press('c', true)).toBe('score');
    expect(press('C', true)).toBe('score');
    expect(press('c', false)).toBeNull();
  });

  it('C types into the request field instead of switching', () => {
    expect(press('c', true, el('INPUT'))).toBeNull();
    expect(press('c', true, el('BUTTON', { inDialog: true }))).toBeNull();
  });
});

describe('closesAction', () => {
  it('Escape outside a text field closes the open action', () => {
    expect(closesAction({ key: 'Escape', target: el('BODY'), defaultPrevented: false } as never)).toBe(true);
  });

  it('not while typing, nor when a menu or dialog already took the Escape', () => {
    expect(closesAction({ key: 'Escape', target: el('TEXTAREA'), defaultPrevented: false } as never)).toBe(false);
    expect(closesAction({ key: 'Escape', target: el('BODY'), defaultPrevented: true } as never)).toBe(false);
    expect(closesAction({ key: 'r', target: el('BODY'), defaultPrevented: false } as never)).toBe(false);
  });
});
