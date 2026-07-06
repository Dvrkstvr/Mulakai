import type { Region } from './Waveform';
import type { Section } from './lyricSections';

interface Props {
  sections: Section[];
  activeIndex: number; // -1 = no section exactly selected; see lyricSections.findActiveSectionIndex
  onSelect: (region: Region) => void;
  onSeek: (seconds: number) => void;
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/**
 * Structural ribbon over the lane stack: one clip-path parallelogram per lyric
 * section, flex-weighted by duration, sky when selected (DESIGN.md "Section
 * strip"). Click sets it as the current repaint region — the "repaint the
 * chorus in one click" payoff of lyric-aligned sections. Double-click does the
 * same and also moves the playhead to the section's start, for quick preview.
 */
export function SectionStrip({ sections, activeIndex, onSelect, onSeek }: Props) {
  if (sections.length === 0) return null;
  return (
    <div className="section-strip" aria-label="Song sections">
      {sections.map((s, i) => (
        <button
          key={`${s.start}-${i}`}
          type="button"
          className={`section-seg${i === activeIndex ? ' active' : ''}`}
          style={{ flexGrow: Math.max(0.0001, s.end - s.start) }}
          onClick={() => onSelect({ start: s.start, end: s.end })}
          onDoubleClick={() => { onSelect({ start: s.start, end: s.end }); onSeek(s.start); }}
          title={`${s.label || 'Section'} · ${fmt(s.start)}–${fmt(s.end)}`}
        >
          <span>{s.label || '—'}</span>
        </button>
      ))}
    </div>
  );
}
