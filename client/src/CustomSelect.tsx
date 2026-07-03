import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  label: string;
  value: string;
  options: { label: string; value: string }[];
  onChange: (v: string) => void;
}

/** Skewed-parallelogram dropdown per docs/design/DESIGN.md's choice-shape grammar. */
export function CustomSelect({ label, value, options, onChange }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const currentLabel = options.find((o) => o.value === value)?.label || '—';
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

  return (
    <div className="setting" ref={containerRef}>
      <div className="setting-head"><span>{label}</span></div>
      <div style={{ position: 'relative' }}>
        <motion.button
          className={`custom-select-button ${isOpen ? 'open' : ''}`}
          onClick={() => setIsOpen(!isOpen)}
          animate={{ skewX: isOpen ? -10 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <span>{currentLabel}</span>
          <svg fill="currentColor" height="14" viewBox="0 0 24 24" width="14" xmlns="http://www.w3.org/2000/svg"><path d="M7 10l5 5 5-5z"/></svg>
        </motion.button>
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
                >
                  {opt.label}
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
