import { describe, it, expect } from 'vitest';
import { laneLines } from './lyricsLaneLines';

const span = (start: number, end: number) => ({ start, end });

describe('laneLines', () => {
  const draft = '[Verse]\nNeon on the wet black glass\n\nEvery signal turning red\n[Humming]\nI keep the engine humming low';

  it('places each heard line at its span, keeping its draft index', () => {
    const { lines } = laneLines(draft, [null, span(8, 12), null, span(13, 17.5), null, span(19, 24)]);
    expect(lines).toEqual([
      { index: 1, text: 'Neon on the wet black glass', start: 8, end: 12 },
      { index: 3, text: 'Every signal turning red', start: 13, end: 17.5 },
      { index: 5, text: 'I keep the engine humming low', start: 19, end: 24 },
    ]);
  });

  it('counts sung lines that were not heard, but not tags or blank lines', () => {
    const { lines, unheard } = laneLines(draft, [null, span(8, 12), null, null, null, null]);
    expect(lines.map((l) => l.index)).toEqual([1]);
    expect(unheard).toBe(2);
  });

  it('has no chips before the reading exists', () => {
    expect(laneLines(draft, [])).toEqual({ lines: [], unheard: 3 });
  });
});
