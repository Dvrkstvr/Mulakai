import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { api, type LyricTag } from './api';
import { LyricTagGuideContent } from './LyricTagGuideContent';

/** Portal-rendered flyout (same open/click-outside pattern as CustomSelect.tsx's dropdown,
 * just bigger and portaled to escape the LYRICS field's scroll container) so the guide is
 * reachable right where lyrics get written, not just buried in Settings. */
export function LyricTagGuidePopover() {
  const [isOpen, setIsOpen] = useState(false);
  const [tags, setTags] = useState<LyricTag[] | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && tags === null) api.listLyricTags().then(setTags).catch(() => setTags([]));
  }, [isOpen, tags]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (btnRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setIsOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const rect = btnRef.current?.getBoundingClientRect();
  const panelStyle = rect
    ? { top: rect.bottom + 6, left: Math.min(rect.left, window.innerWidth - 460 - 12) }
    : undefined;

  return (
    <>
      <button ref={btnRef} type="button" className="tag-guide-btn" onClick={() => setIsOpen((v) => !v)}>
        <span>TAG GUIDE</span>
      </button>
      {createPortal(
        <AnimatePresence>
          {isOpen && (
            <motion.div
              ref={panelRef}
              className="tag-guide-panel"
              style={panelStyle}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
            >
              <div className="tag-guide-panel-head">
                <span className="section-label">LYRIC TAG GUIDE</span>
                <button type="button" className="tag-guide-close" onClick={() => setIsOpen(false)} aria-label="Close">×</button>
              </div>
              <div className="hint">
                How ACE-Step's lyric annotation tags actually work, distilled from probed
                generations — not a fixed spec, just the patterns that showed up.
              </div>
              {tags === null ? <span className="meta">loading…</span> : <LyricTagGuideContent tags={tags} />}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}
