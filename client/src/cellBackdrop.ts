/** The app background (DESIGN.md "Surfaces"): carbon cut into large Voronoi cells, each a shade
 * or two off carbon — broken glass seen through glass, barely there. One seamless tile, built
 * once at startup; the cells wrap round its edges so it repeats without a seam. */
export const CELLS = {
  /** Tile edge, px. */
  size: 960,
  /** Cells per tile — about 200px across each. */
  count: 24,
  /** Largest shade offset from carbon, in 0..255 steps. */
  amp: 2,
  seed: 7,
};

const CARBON = [28, 29, 33];

/** A fixed seeded sequence, so the cells never change between visits. */
function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

/** Shortest offset between two points on a ring of length `size`. */
function wrap(d: number, size: number): number {
  if (d > size / 2) return d - size;
  if (d < -size / 2) return d + size;
  return d;
}

/** RGBA pixels for a `size`×`size` tile. */
export function cellBackdrop(size = CELLS.size, count = CELLS.count, amp = CELLS.amp): Uint8ClampedArray<ArrayBuffer> {
  const rnd = seeded(CELLS.seed);
  const cells = Array.from({ length: count }, () => ({ x: rnd() * size, y: rnd() * size, shade: Math.round((rnd() * 2 - 1) * amp) }));
  const px = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let best = Infinity;
      let shade = 0;
      for (const c of cells) {
        const dx = wrap(x - c.x, size);
        const dy = wrap(y - c.y, size);
        const d = dx * dx + dy * dy;
        if (d < best) {
          best = d;
          shade = c.shade;
        }
      }
      const o = (y * size + x) * 4;
      px[o] = CARBON[0] + shade;
      px[o + 1] = CARBON[1] + shade;
      px[o + 2] = CARBON[2] + shade;
      px[o + 3] = 255;
    }
  }
  return px;
}

/** Paints the tile and hands it to CSS as `--cell-backdrop` (index.css `body`). */
export function applyCellBackdrop(): void {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = CELLS.size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.putImageData(new ImageData(cellBackdrop(), CELLS.size, CELLS.size), 0, 0);
  document.documentElement.style.setProperty('--cell-backdrop', `url(${canvas.toDataURL()})`);
}
