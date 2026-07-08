import { useLayoutEffect, useRef } from 'react';

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

/** Text box that grows vertically to fit its content instead of scrolling internally —
 * used in place of plain `<input>`/`<textarea>` on the Create view so long prompts,
 * titles, and lyrics stay fully readable (per user request: page may get long, text
 * must never be clipped or hidden behind a scrollbar). */
export function AutoTextarea({ value, onChange, placeholder, className, disabled }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const resize = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };

  useLayoutEffect(resize, [value]);

  // Re-measure when the box's own width changes (panel resize, window resize) —
  // otherwise a height computed at one width goes stale once wrapping changes at
  // another, without `value` ever changing to re-trigger the effect above.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <textarea
      ref={ref}
      rows={1}
      className={className ? `autosize ${className}` : 'autosize'}
      placeholder={placeholder}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
