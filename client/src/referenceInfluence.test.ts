import { describe, expect, it } from 'vitest';
import { influenceHint, showsStyleInfluence } from './referenceInfluence';

describe('showsStyleInfluence', () => {
  it('shows style for text2music', () => {
    expect(showsStyleInfluence('text2music')).toBe(true);
  });

  it('hides it for cover (COVER) — VARIANCE drives it instead', () => {
    expect(showsStyleInfluence('cover')).toBe(false);
  });

  it('hides it for complete (ARRANGE) — the server never applies it', () => {
    expect(showsStyleInfluence('complete')).toBe(false);
  });
});

describe('influenceHint', () => {
  it('states the style percentage for text2music', () => {
    expect(influenceHint('text2music', 0.35)).toBe(' — style 35%');
  });

  it('does not claim any influence percentages for complete', () => {
    const hint = influenceHint('complete', 0.35);
    expect(hint).not.toMatch(/%/);
    expect(hint).toContain('ARRANGE has no influence controls');
  });

  it('points cover at VARIANCE without referring to hidden sliders', () => {
    const hint = influenceHint('cover', 0.35);
    expect(hint).toContain('VARIANCE');
    expect(hint).not.toMatch(/%|slider/);
  });
});
