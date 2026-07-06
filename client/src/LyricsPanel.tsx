import { useEffect, useRef } from 'react';
import type { LyricsBlock } from './lyricsBlocks';

interface Props {
  blocks: LyricsBlock[];
  draft: string;
  onDraftChange: (text: string) => void;
  activeBlock: LyricsBlock | null;
  unlocked: boolean;
}

/**
 * Left-rail lyrics view: read-only by default; unlocks into an editable
 * textarea only while the current selection is exactly one whole section on
 * the base layer (see Editor.tsx's `lyricsUnlocked`) — editing at any other
 * granularity isn't meaningful since ACE-Step's repaint only re-renders the
 * selected region. `activeBlock` (the matching block for whatever section is
 * selected) is always shown highlighted when locked, and native-selected
 * (so the browser visibly marks it, ready to type over) when unlocked.
 */
export function LyricsPanel({ blocks, draft, onDraftChange, activeBlock, unlocked }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!unlocked || !activeBlock || !textareaRef.current) return;
    const el = textareaRef.current;
    el.focus();
    el.setSelectionRange(activeBlock.start, activeBlock.end);
    const before = draft.slice(0, activeBlock.start);
    const lineIndex = before.split('\n').length - 1;
    const approxLineHeight = 17;
    el.scrollTop = Math.max(0, lineIndex * approxLineHeight - approxLineHeight * 2);
    // Only re-run when the target block/lock state changes, not on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBlock, unlocked]);

  if (blocks.length === 0) return null;

  return (
    <div className="lyrics-panel">
      <div className="section-label">LYRICS</div>
      {unlocked ? (
        <textarea
          ref={textareaRef}
          className="lyrics-textarea"
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          spellCheck={false}
        />
      ) : (
        <div className="lyrics-readonly">
          {blocks.map((b, i) => (
            <div key={i} className={`lyrics-block${b === activeBlock ? ' active' : ''}`}>
              {b.text.split('\n').map((line, li) => (
                <div key={li} className={li === 0 && b.label ? 'lyrics-tag' : undefined}>{line || ' '}</div>
              ))}
            </div>
          ))}
        </div>
      )}
      {unlocked && (
        <div className="lyrics-hint">editing applies to this repaint — adjusting the region re-locks it</div>
      )}
      {!unlocked && activeBlock && (
        <div className="lyrics-hint">select this whole section (on the base layer) to edit its lyrics</div>
      )}
    </div>
  );
}
