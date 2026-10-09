import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { FacetGlass } from './FacetGlass';

export const HEAD_GLASS_ID = 'head-facet-glass';

/** The Library's create bar + toolbar as one faceted-glass pane (same cut as the footer) that the
 * list scrolls under. Publishes its height as `--glass-head-h` on the parent so the scroll area
 * can tuck up behind it and pad its start by the same amount. */
export function GlassHead({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    const parent = el?.parentElement;
    if (!el || !parent) return;
    const sync = () => parent.style.setProperty('--glass-head-h', `${el.offsetHeight}px`);
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return (
    <div className="glass-head" ref={ref}>
      <FacetGlass target={ref} id={HEAD_GLASS_ID} />
      {children}
    </div>
  );
}
