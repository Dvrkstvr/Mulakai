import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Small "?" affordance with a hover/focus popup — portal-rendered to document.body
 * (position: fixed, placed via getBoundingClientRect) so it can't be clipped by a
 * scrollable ancestor (settings panel's ScrollArea) or an overflow:hidden control
 * (Toggle's shader mask). Same fix CustomSelect already uses for its option flyout.
 */
export function InfoTooltip({ text }: { text: string }) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const ref = useRef<HTMLSpanElement>(null);

  const show = () => {
    const rect = ref.current?.getBoundingClientRect();
    if (rect) setPos({ top: rect.bottom + 6, left: rect.left });
  };
  const hide = () => setPos(null);

  return (
    <span
      className="info-tooltip"
      ref={ref}
      tabIndex={0}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      <span className="info-tooltip-mark">?</span>
      {pos && createPortal(
        <span className="info-tooltip-text" style={{ top: pos.top, left: pos.left }}>{text}</span>,
        document.body,
      )}
    </span>
  );
}
