/** LOOP SELECTION: wrap at the selection's end, never from a playhead already past it; turning it on starts inside. */
import { describe, expect, it } from 'vitest';
import { loopEntry, loopWrap } from './loopSelection';

const sel = { start: 10, end: 20 };

describe('loopWrap', () => {
  it("crossing the selection's end goes back to its start", () => {
    expect(loopWrap(19.98, 20.01, sel)).toBe(10);
  });

  it('plays on inside the selection, and from a playhead seeked past its end', () => {
    expect(loopWrap(12, 12.02, sel)).toBeNull();
    expect(loopWrap(25, 25.02, sel)).toBeNull();
  });

  it('no selection, no loop', () => {
    expect(loopWrap(19.98, 20.01, null)).toBeNull();
  });
});

describe('loopEntry', () => {
  it('outside the selection: start it from its start; inside: leave the playhead', () => {
    expect(loopEntry(3, sel)).toBe(10);
    expect(loopEntry(22, sel)).toBe(10);
    expect(loopEntry(15, sel)).toBeNull();
  });
});
