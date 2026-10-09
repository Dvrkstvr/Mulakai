import { useEffect, useState, type RefObject } from 'react';
import { FACET, facetDisplacement } from './facetMap';

export const FACET_GLASS_ID = 'footer-facet-glass';

interface FacetMap { width: number; height: number; href: string }

/** Renders the displacement map at `target`'s size and redraws it on resize — stretching one
 * map would bend the facets' −10° lean. */
function useFacetMap(target: RefObject<HTMLElement | null>): FacetMap | null {
  const [map, setMap] = useState<FacetMap | null>(null);
  useEffect(() => {
    const el = target.current;
    if (!el) return;
    const draw = () => {
      const width = Math.round(el.offsetWidth);
      const height = Math.round(el.offsetHeight);
      if (!width || !height) return;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.putImageData(new ImageData(facetDisplacement(width, height), width, height), 0, 0);
      setMap({ width, height, href: canvas.toDataURL() });
    };
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(el);
    return () => observer.disconnect();
  }, [target]);
  return map;
}

/** The SVG filter the footer's `backdrop-filter: url(#footer-facet-glass)` points at. Browsers
 * without SVG backdrop filters keep the plain tint + blur fallback from index.css. */
export function FacetGlass({ target, id = FACET_GLASS_ID }: { target: RefObject<HTMLElement | null>; id?: string }) {
  const map = useFacetMap(target);
  if (!map) return null;
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <filter id={id} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
        <feImage href={map.href} x="0" y="0" width={map.width} height={map.height} preserveAspectRatio="none" result="map" />
        <feGaussianBlur in="SourceGraphic" stdDeviation={FACET.blur} result="soft" />
        <feDisplacementMap in="soft" in2="map" scale={FACET.scale} xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </svg>
  );
}
