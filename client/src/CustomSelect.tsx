import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { InfoTooltip } from './InfoTooltip';

interface Props {
  /** Omit for a compact inline control with no label row (e.g. Library's SORT). */
  label?: string;
  value: string;
  /** `description` (optional) explains what that option is best for — shown next to the
   * label for the currently-selected option, and as a hover flyout per dropdown row. */
  options: { label: string; value: string; description?: string }[];
  onChange: (v: string) => void;
}

/**
 * Skewed-parallelogram dropdown per docs/design/DESIGN.md's choice-shape
 * grammar — skewed at rest like every other choice control (chip/tab/toggle),
 * not just while open.
 */
export function CustomSelect({ label, value, options, onChange }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  // Portal-rendered so the flyout can't inflate the scrollable dropdown's
  // content box (an absolutely-positioned child inside it previously forced
  // both scrollbars to appear, even while invisible — see index.css history).
  const [hover, setHover] = useState<{ text: string; top: number; left: number } | null>(null);
  const currentOption = options.find((o) => o.value === value);
  const currentLabel = currentOption?.label || '—';
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen) setHover(null);
  }, [isOpen]);

  return (
    <div className={label ? 'setting' : 'custom-select compact'} ref={containerRef}>
      {label && (
        <div className="setting-head">
          <span>{label}{currentOption?.description && <InfoTooltip text={currentOption.description} />}</span>
        </div>
      )}
      <div style={{ position: 'relative' }}>
        <button
          className={`custom-select-button ${isOpen ? 'open' : ''}`}
          onClick={() => setIsOpen(!isOpen)}
        >
          <span>{currentLabel}</span>
          <svg fill="currentColor" height="14" viewBox="0 0 24 24" width="14" xmlns="http://www.w3.org/2000/svg"><path d="M7 10l5 5 5-5z"/></svg>
        </button>
        <AnimatePresence>
          {isOpen && (
            <motion.div
              className="custom-select-dropdown"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
            >
              {options.map((opt, i) => (
                <motion.div
                  key={opt.value}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03, duration: 0.15 }}
                  className="custom-select-option"
                  onClick={() => { onChange(opt.value); setIsOpen(false); }}
                  onMouseEnter={(e) => {
                    if (!opt.description) return;
                    const rect = e.currentTarget.getBoundingClientRect();
                    setHover({ text: opt.description, top: rect.top, left: rect.right + 8 });
                  }}
                  onMouseLeave={() => setHover(null)}
                >
                  {opt.label}
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {hover && createPortal(
        <div className="option-description" style={{ top: hover.top, left: hover.left }}>{hover.text}</div>,
        document.body,
      )}
    </div>
  );
}
