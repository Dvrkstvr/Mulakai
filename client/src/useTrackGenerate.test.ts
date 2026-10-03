import { describe, expect, it } from 'vitest';
import { trackParams } from './useTrackGenerate';
import { useSettings, type GenSettings } from './settings';

const gen = (over: Partial<GenSettings> = {}): GenSettings => ({ ...useSettings.getState().gen, ...over });
const BASE = 'acestep-v15-xl-base';

describe('ONE TRACK model precedence', () => {
  it('sends the card\'s own model even when AN IDEA has a DIT MODEL set', () => {
    expect(trackParams(gen({ model: 'acestep-v15-turbo' }), BASE).model).toBe(BASE);
  });

  it('resolves QUALITY on the card\'s model, not AN IDEA\'s', () => {
    expect(trackParams(gen({ model: 'acestep-v15-turbo', quality: 'best' }), BASE).inference_steps).toBe(64);
  });

  it('leaves the shared model alone only while the card has none picked', () => {
    expect(trackParams(gen({ model: 'acestep-v15-turbo' }), '').model).toBe('acestep-v15-turbo');
  });
});
