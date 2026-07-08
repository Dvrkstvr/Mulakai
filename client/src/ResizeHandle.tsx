interface Props {
  onPointerDown: (e: React.PointerEvent) => void;
  side: 'left' | 'right';
}

/** Thin drag handle on the center-facing edge of a resizable column (useResizableWidth.ts) —
 * `side` picks which edge of the column it sits on. */
export function ResizeHandle({ onPointerDown, side }: Props) {
  return <div className={`resize-handle resize-handle-${side}`} onPointerDown={onPointerDown} />;
}
