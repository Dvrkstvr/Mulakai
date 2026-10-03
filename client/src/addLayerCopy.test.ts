import { describe, it, expect } from 'vitest';
import { addLayerCommitLabel, addLayerConsequence, addLayerName, sungTrack } from './addLayerCopy';

describe('add layer copy', () => {
  it('names the lane after the picked track', () => {
    expect(addLayerName('warm string pad, slow swells', 'strings')).toBe('strings');
    expect(addLayerName('ooh harmonies', 'backing_vocals')).toBe('backing vocals');
  });

  it("names it from the description's first four words under AUTO", () => {
    expect(addLayerName('  punchy drums and a walking bassline ', '')).toBe('punchy drums and a');
    expect(addLayerName('', '')).toBe('');
  });

  it('labels the commit by track, or ADD LAYER under AUTO', () => {
    expect(addLayerCommitLabel('strings')).toBe('ADD STRINGS');
    expect(addLayerCommitLabel('fx')).toBe('ADD FX');
    expect(addLayerCommitLabel('')).toBe('ADD LAYER');
  });

  it('states the lane and version it adds', () => {
    expect(addLayerConsequence('strings')).toBe('Adds a STRINGS lane as strings v1, conditioned on the current mix · nothing else changes');
    expect(addLayerConsequence('')).toBe('Adds a lane named from its description, conditioned on the current mix · nothing else changes');
  });

  it('offers lyrics only to vocals and backing vocals', () => {
    expect(sungTrack('vocals')).toBe(true);
    expect(sungTrack('backing_vocals')).toBe(true);
    expect(sungTrack('strings')).toBe(false);
    expect(sungTrack('')).toBe(false);
  });
});
