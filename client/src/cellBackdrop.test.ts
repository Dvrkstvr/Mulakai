import { describe, expect, it } from 'vitest';
import { cellBackdrop } from './cellBackdrop';

const at = (px: Uint8ClampedArray, w: number, x: number, y: number) =>
  Array.from(px.slice(4 * (y * w + x), 4 * (y * w + x) + 4));

describe('cellBackdrop', () => {
  it('stays within amp of carbon, opaque, on every pixel', () => {
    const px = cellBackdrop(64, 6, 2);
    expect(px.length).toBe(64 * 64 * 4);
    for (let k = 0; k < px.length; k += 4) {
      expect(Math.abs(px[k] - 28)).toBeLessThanOrEqual(2);
      expect(px[k + 1] - px[k]).toBe(1);
      expect(px[k + 2] - px[k]).toBe(5);
      expect(px[k + 3]).toBe(255);
    }
  });

  it('cuts the tile into more than one shade', () => {
    const px = cellBackdrop(64, 6, 2);
    const shades = new Set<number>();
    for (let k = 0; k < px.length; k += 4) shades.add(px[k]);
    expect(shades.size).toBeGreaterThan(1);
  });

  it('wraps round its edges, so the tile repeats without a seam', () => {
    const size = 64;
    const px = cellBackdrop(size, 6, 2);
    let same = 0;
    for (let y = 0; y < size; y++) if (at(px, size, 0, y)[0] === at(px, size, size - 1, y)[0]) same++;
    expect(same).toBeGreaterThan(size * 0.8);
  });

  it('is the same cut every time', () => {
    expect(cellBackdrop(48, 5, 2)).toEqual(cellBackdrop(48, 5, 2));
  });
});
