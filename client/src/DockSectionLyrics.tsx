import { useEffect, useRef, useState } from 'react';
import type { LyricsBlock } from './lyricsBlocks';

interface Props {
  section: string;
  draft: string;
  onDraftChange: (text: string) => void;
  activeBlock: LyricsBlock | null;
}

/**
 * REPAINT's `EDIT VERSE 2 LYRICS` disclosure, offered only while the selection is exactly one
 * whole section on the base layer (useSectionLyrics.ts's `lyricsUnlocked`): editing at any other
 * granularity isn't meaningful, since a repaint only re-renders its region. The edited draft goes
 * with the repaint as conditioning and becomes the song's lyrics if it lands.
 */
export function DockSectionLyrics({ section, draft, onDraftChange, activeBlock }: Props) {
  const [open, setOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Native-selects the section's block, ready to type over, whenever it opens or the section changes.
  useEffect(() => {
    if (!open || !activeBlock || !textareaRef.current) return;
    const el = textareaRef.current;
    el.focus();
    el.setSelectionRange(activeBlock.start, activeBlock.end);
    const lineIndex = draft.slice(0, activeBlock.start).split('\n').length - 1;
    const approxLineHeight = 17;
    el.scrollTop = Math.max(0, lineIndex * approxLineHeight - approxLineHeight * 2);
    // Only on open / a new block, not on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBlock, open]);

  return (
    <div className="dock-lyrics">
      <button type="button" className="tab dock-quiet" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span>EDIT {section} LYRICS {open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <>
          <textarea
            ref={textareaRef}
            className="lyrics-textarea"
            value={draft}
            onChange={(e) => onDraftChange(e.target.value)}
            spellCheck={false}
          />
          <div className="lyrics-hint">editing applies to this repaint — adjusting the region re-locks it</div>
        </>
      )}
    </div>
  );
}
