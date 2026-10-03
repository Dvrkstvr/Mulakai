import { describe, expect, it } from 'vitest';
import { INSTRUMENTAL_LYRICS, isInstrumental, toggleInstrumental } from './instrumental';

describe('INSTRUMENTAL toggle', () => {
  it('turns empty lyrics into the instrumental tag and back', () => {
    expect(toggleInstrumental('')).toBe(INSTRUMENTAL_LYRICS);
    expect(toggleInstrumental('  \n')).toBe(INSTRUMENTAL_LYRICS);
    expect(toggleInstrumental(INSTRUMENTAL_LYRICS)).toBe('');
  });

  it('never replaces typed words', () => {
    expect(toggleInstrumental('[Verse]\nneon on the glass')).toBeNull();
  });

  it('reads the tag case- and whitespace-insensitively', () => {
    expect(isInstrumental(' [instrumental]\n')).toBe(true);
    expect(isInstrumental('[Verse]')).toBe(false);
  });
});
