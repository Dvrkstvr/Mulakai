import { describe, expect, it } from 'vitest';
import { deleteLayerLine } from './laneMenuCopy';

describe('deleteLayerLine', () => {
  it('names the layer and how many takes go with it', () => {
    expect(deleteLayerLine('Drums', 1)).toBe("Deletes DRUMS and its take · this can't be undone");
    expect(deleteLayerLine('Backing vocals', 3)).toBe("Deletes BACKING VOCALS and its 3 takes · this can't be undone");
  });
});
