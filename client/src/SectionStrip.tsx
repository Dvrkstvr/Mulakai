import type { Region } from './Waveform';
import type { Section } from './lyricSections';

interface Props {
  sections: Section[];
  selection: Region | null;
  onSelect: (region: Region) => void;
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/** A section is "active" (sky) when the current region selection matches its span. */
const isActive = (s: Section, sel: Region | null) =>
  !!sel && Math.abs(sel.start - s.start) < 0.05 && Math.abs(sel.end - s.end) < 0.05;

/**
 * Structural ribbon over the lane stack: one clip-path parallelogram per lyric
 * section, flex-weighted by duration, sky when selected (DESIGN.md "Section
 * strip"). Clicking a segment sets it as the current repaint region — the
 * "repaint the chorus in one click" payoff of lyric-aligned sections.
 */
export function SectionStrip({ sections, selection, onSelect }: Props) {
  if (sections.length === 0) return null;
  return (
    <div className="section-strip" aria-label="Song sections">
      {sections.map((s, i) => (
        <button
          key={`${s.start}-${i}`}
          type="button"
          className={`section-seg${isActive(s, selection) ? ' active' : ''}`}
          style={{ flexGrow: Math.max(0.0001, s.end - s.start) }}
          onClick={() => onSelect({ start: s.start, end: s.end })}
          title={`${s.label || 'Section'} · ${fmt(s.start)}–${fmt(s.end)}`}
        >
          <span>{s.label || '—'}</span>
        </button>
      ))}
    </div>
  );
}
