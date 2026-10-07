/** The footer's faceted glass (DESIGN.md "Footer player"): the backdrop is cut into −10°
 * parallelogram facets — the same lean as the UI's parallelogram choices — in two rows, and each
 * facet shifts what sits behind it by its own fixed offset, like cut crystal. This builds the
 * feDisplacementMap input: R = x shift, G = y shift, 128 = none. */
export const FACET = {
  /** Facet width along the slanted axis, px. */
  width: 44,
  rows: 2,
  /** feDisplacementMap scale: the largest shift is half of it, px. */
  scale: 14,
  /** Backdrop softening before the shift (SVG stdDeviation, px). */
  blur: 1,
};

const TAN_10 = Math.tan((10 * Math.PI) / 180);
/** Vertical shifts are kept smaller than horizontal so rows don't tear apart. */
const Y_DAMP = 0.6;

/** A fixed pseudo-random 0..1 per facet, so the cut never changes between renders. */
export function facetNoise(a: number, b: number): number {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Which facet a pixel falls in: columns lean −10° (top shifted right, like skewX(−10deg)). */
export function facetOf(x: number, y: number, height: number): { col: number; row: number } {
  return { col: Math.floor((x + y * TAN_10) / FACET.width), row: Math.floor(y / (height / FACET.rows)) };
}

/** RGBA pixels for a `width`×`height` displacement map. */
export function facetDisplacement(width: number, height: number): Uint8ClampedArray<ArrayBuffer> {
  const px = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const { col, row } = facetOf(x, y, height);
      const k = 4 * (y * width + x);
      px[k] = Math.round(128 + 127 * (facetNoise(col, row) * 2 - 1));
      px[k + 1] = Math.round(128 + 127 * (facetNoise(row, col + 9) * 2 - 1) * Y_DAMP);
      px[k + 2] = 128;
      px[k + 3] = 255;
    }
  }
  return px;
}
