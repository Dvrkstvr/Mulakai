import { useEffect, useRef, useState, type ReactNode } from 'react';

interface Props {
  className?: string;
  children: ReactNode;
}

/**
 * Wraps a scrollable region with its native scrollbar hidden — a bouncing
 * chevron at the top/bottom signals there's more content instead, so
 * scrolling stays visually confined to this one component rather than
 * showing a scrollbar. `className` lands on the scrolling viewport itself,
 * so existing layout classes (e.g. `.create-content`) still apply unchanged.
 */
export function ScrollArea({ className, children }: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);

  const updateHints = () => {
    const el = viewportRef.current;
    if (!el) return;
    setCanScrollUp(el.scrollTop > 2);
    setCanScrollDown(el.scrollTop + el.clientHeight < el.scrollHeight - 2);
  };

  // No dep array: content height can change from typing/tab-switching without
  // resizing the viewport element itself, so hints are recomputed every render.
  useEffect(() => {
    updateHints();
    window.addEventListener('resize', updateHints);
    return () => window.removeEventListener('resize', updateHints);
  });

  return (
    <div className="scroll-area">
      <div
        ref={viewportRef}
        className={className ? `scroll-area-viewport ${className}` : 'scroll-area-viewport'}
        onScroll={updateHints}
      >
        {children}
      </div>
      {canScrollUp && <div className="scroll-hint scroll-hint-up" aria-hidden="true" />}
      {canScrollDown && <div className="scroll-hint scroll-hint-down" aria-hidden="true" />}
    </div>
  );
}
