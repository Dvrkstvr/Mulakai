import { describe, expect, it } from 'vitest';
import { influenceHint, influenceSliders } from './referenceInfluence';

describe('influenceSliders', () => {
  it('shows style only for text2music', () => {
    expect(influenceSliders('text2music')).toEqual({ audio: false, style: true });
  });

  it('hides both sliders for complete (ARRANGE) — the server never applies them', () => {
    expect(influenceSliders('complete')).toEqual({ audio: false, style: false });
  });

  it('leaves cover unchanged', () => {
    expect(influenceSliders('cover')).toEqual({ audio: true, style: true });
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

  it('points cover at VARIANCE', () => {
    expect(influenceHint('cover', 0.35)).toContain('VARIANCE');
  });
});
