import { useMemo, useState, type CSSProperties, type MouseEvent } from 'react';
import type { WordTimings } from './api';
import type { Region } from './Waveform';
import type { LyricTiming } from './useLyricTiming';
import { alignLyrics, tokenize } from './lyricAlign';
import { lineRegion, sameRegion } from './lineSelection';
import { laneLines } from './lyricsLaneLines';
import { fmtRange } from './dockTarget';

export interface LyricsLaneProps {
  /** The Editor's lyrics draft: lines align against it, so they stay right after an unrepainted edit. */
  draft: string;
  /** The base version's reading, or null until it's read. */
  timings: WordTimings | null;
  timing: Pick<LyricTiming, 'status' | 'error' | 'retry'>;
  duration: number;
  /** The selection while REPAINT is the verb, else null (no sky echo for another verb's target). */
  selection: Region | null;
  onSelect: (region: Region) => void;
  onSeek: (seconds: number) => void;
}

const pct = (s: number, duration: number) => `${Math.min(100, Math.max(0, (s / duration) * 100))}%`;

/**
 * The LYRICS lane between the scrub ruler and the first layer (PLAN.md "UI Redesign", S1
 * decision 8): each heard line is a chip at its sung span. Click selects it, shift-click extends
 * from the last clicked line, double-click also moves the playhead there; a line under the
 * repaint minimum is widened (lineSelection.ts). No lyrics, no lane.
 */
export function LyricsLane({ draft, timings, timing, duration, selection, onSelect, onSeek }: LyricsLaneProps) {
  const hasWords = useMemo(() => tokenize(draft).length > 0, [draft]);
  const spans = useMemo(() => (timings ? alignLyrics(draft, timings).lines : null), [draft, timings]);
  const { lines, unheard } = useMemo(() => laneLines(draft, spans ?? []), [draft, spans]);
  const [range, setRange] = useState<{ from: number; to: number } | null>(null);
  // The sky echo holds only while the selection is still what the clicked lines made.
  const echo = range && spans && sameRegion(lineRegion(spans, range.from, range.to, duration), selection) ? range : null;

  if (!hasWords) return null;

  const pick = (index: number, e: MouseEvent, seek: boolean) => {
    if (!spans) return;
    const from = e.shiftKey && range ? range.from : index;
    const region = lineRegion(spans, from, index, duration);
    if (!region) return;
    setRange({ from, to: index });
    onSelect(region);
    if (seek) onSeek(spans[index]?.start ?? region.start);
  };

  return (
    <div className="lyrics-lane" aria-label="Lyrics">
      {/* Under the chips: a line sung from 0:00 may cover it, and the line says what it is anyway. */}
      <div className="lyrics-lane-label">LYRICS</div>
      {(timing.status !== 'idle' || (spans && unheard > 0)) && (
        <div className="lyrics-lane-status">
          {timing.status === 'reading' && <span className="lyrics-timing">TIMING…</span>}
          {timing.status !== 'reading' && spans && unheard > 0 && (
            <span className="lyrics-timing">{unheard} line{unheard === 1 ? '' : 's'} not heard</span>
          )}
          {timing.status === 'failed' && (
            <span className="warn-note lyrics-lane-warn" title={timing.error}>
              couldn't time these lyrics <button type="button" onClick={timing.retry}>RETRY</button>
            </span>
          )}
        </div>
      )}
      {duration > 0 && lines.map((line) => {
        const selected = !!echo && line.index >= Math.min(echo.from, echo.to) && line.index <= Math.max(echo.from, echo.to);
        const style: CSSProperties = { left: pct(line.start, duration), width: pct(line.end - line.start, duration) };
        return (
          <button
            key={line.index}
            type="button"
            className={`lyrics-chip${selected ? ' selected' : ''}`}
            style={style}
            title={`${line.text} · ${fmtRange(line)} · click to select · shift-click to extend · double-click to play from here`}
            // Keeps shift-click and double-click from also selecting text.
            onMouseDown={(e) => { if (e.shiftKey || e.detail > 1) e.preventDefault(); }}
            onClick={(e) => pick(line.index, e, false)}
            onDoubleClick={(e) => pick(line.index, e, true)}
          >
            {line.text}
          </button>
        );
      })}
    </div>
  );
}
