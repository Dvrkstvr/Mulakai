import { useMemo, useState, type MouseEvent } from 'react';
import type { WordTimings } from './api';
import type { Region } from './Waveform';
import type { LyricsBlock } from './lyricsBlocks';
import { alignLyrics } from './lyricAlign';
import { lineRegion, sameRegion } from './lineSelection';

export interface LineSelect {
  /** The base version's reading, or null until it's read. */
  timings: WordTimings | null;
  duration: number;
  selection: Region | null;
  onSelect: (region: Region) => void;
  onSeek: (seconds: number) => void;
}

interface Props extends LineSelect {
  blocks: LyricsBlock[];
  draft: string;
  activeBlock: LyricsBlock | null;
}

const TAG_RE = /^\s*\[[^\]]+\]\s*$/;

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/**
 * The lyrics panel's read-only view (PLAN.md "Editor Word Timestamps", decision 8). A line
 * that was heard is clickable: click selects when it's sung, shift-click extends from the
 * last clicked line, double-click also moves the playhead there. Lines are aligned against
 * the draft shown here, so they stay right after edits that haven't been repainted yet.
 */
export function LyricsLines({ blocks, draft, activeBlock, timings, duration, selection, onSelect, onSeek }: Props) {
  const spans = useMemo(() => (timings ? alignLyrics(draft, timings).lines : null), [draft, timings]);
  const [range, setRange] = useState<{ from: number; to: number } | null>(null);
  // The sky echo holds only while the selection is still what the clicked lines made.
  const echo = range && spans && sameRegion(lineRegion(spans, range.from, range.to, duration), selection) ? range : null;

  const pick = (index: number, e: MouseEvent | null, seek: boolean) => {
    if (!spans) return;
    const from = e?.shiftKey && range ? range.from : index;
    const region = lineRegion(spans, from, index, duration);
    if (!region) return;
    setRange({ from, to: index });
    onSelect(region);
    if (seek) onSeek(spans[index]?.start ?? region.start);
  };

  return (
    <div className="lyrics-readonly">
      {blocks.map((b, bi) => {
        const firstLine = draft.slice(0, b.start).split('\n').length - 1;
        return (
          <div key={bi} className={`lyrics-block${b === activeBlock ? ' active' : ''}`}>
            {b.text.split('\n').map((line, li) => {
              const index = firstLine + li;
              const span = spans?.[index];
              if (li === 0 && b.label) return <div key={li} className="lyrics-tag">{line}</div>;
              // A tag inside a block (`[Humming]`) has no words to hear: shown as before, not as unheard.
              if (!spans || !line.trim() || TAG_RE.test(line)) return <div key={li}>{line || ' '}</div>;
              if (!span) return <div key={li} className="lyrics-line untimed" title="not heard in this take">{line}</div>;
              const selected = !!echo && index >= Math.min(echo.from, echo.to) && index <= Math.max(echo.from, echo.to);
              return (
                <div
                  key={li}
                  role="button"
                  tabIndex={0}
                  className={`lyrics-line timed${selected ? ' selected' : ''}`}
                  title={`${fmt(span.start)}–${fmt(span.end)} · click to select · shift-click to extend · double-click to play from here`}
                  // Keeps shift-click and double-click from also selecting text.
                  onMouseDown={(e) => { if (e.shiftKey || e.detail > 1) e.preventDefault(); }}
                  onClick={(e) => pick(index, e, false)}
                  onDoubleClick={(e) => pick(index, e, true)}
                  onKeyDown={(e) => { if (e.key === 'Enter') pick(index, null, false); }}
                >
                  {line}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
