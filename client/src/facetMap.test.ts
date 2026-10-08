import { describe, expect, it } from 'vitest';
import { facetDisplacement, facetOf, FACET } from './facetMap';

const at = (px: Uint8ClampedArray, w: number, x: number, y: number) =>
  Array.from(px.slice(4 * (y * w + x), 4 * (y * w + x) + 4));

describe('facetDisplacement', () => {
  it('fills every pixel with an opaque, blue-neutral shift', () => {
    const px = facetDisplacement(120, 40);
    expect(px.length).toBe(120 * 40 * 4);
    for (let k = 0; k < px.length; k += 4) {
      expect(px[k + 2]).toBe(128);
      expect(px[k + 3]).toBe(255);
    }
  });

  it('shifts a whole facet by one offset', () => {
    const px = facetDisplacement(200, 40);
    expect(at(px, 200, 2, 2)).toEqual(at(px, 200, 20, 6));
  });

  it('gives neighbouring facets different offsets', () => {
    const px = facetDisplacement(200, 40);
    expect(at(px, 200, 2, 2)).not.toEqual(at(px, 200, 2 + FACET.width, 2));
    expect(at(px, 200, 2, 2)).not.toEqual(at(px, 200, 2, 30));
  });

  it('is the same cut every time', () => {
    expect(facetDisplacement(90, 30)).toEqual(facetDisplacement(90, 30));
  });
});

describe('facetOf', () => {
  it('leans the facet edges like skewX(-10deg): lower rows start further left', () => {
    const edgeTop = FACET.width; // first pixel of column 1 on row y = 0
    expect(facetOf(edgeTop, 0, 80).col).toBe(1);
    expect(facetOf(edgeTop - 5, 30, 80).col).toBe(1);
    expect(facetOf(edgeTop - 5, 0, 80).col).toBe(0);
  });

  it('splits the height into two rows', () => {
    expect(facetOf(0, 39, 80).row).toBe(0);
    expect(facetOf(0, 40, 80).row).toBe(1);
  });
});
