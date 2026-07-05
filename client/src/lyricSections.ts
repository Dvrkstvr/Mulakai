import type { LyricLine } from './api';

/** A structural span of the song derived from lyric structure tags. */
export interface Section {
  label: string; // e.g. "Verse 1", "Chorus"; "" for untagged lead-in
  start: number; // seconds
  end: number;
}

/** A lyric line that is nothing but a bracketed structure tag, e.g. "[Chorus]". */
const TAG_RE = /^\[([^\]]+)\]$/;

function tagLabel(text: string): string | null {
  const m = text.trim().match(TAG_RE);
  return m ? m[1].trim() : null;
}

/**
 * Group aligned lyric lines into structural sections by their `[tag]` lines.
 *
 * Each line that is solely a bracketed tag opens a new section starting at that
 * line's time; lines between tags belong to the current section. A section ends
 * where the next tag begins (or at `duration`). Untagged lead-in lines become a
 * single label-less section so the returned spans always tile the whole track:
 * the first section is clamped to 0 and the last to `duration`, matching the
 * DESIGN.md section strip (segments flex-weighted by length, tiling the axis).
 *
 * Returns [] when there is nothing to segment (no lines / instrumental).
 */
export function groupSections(lines: LyricLine[] | null | undefined, duration: number): Section[] {
  if (!lines || lines.length === 0 || duration <= 0) return [];

  const sections: Section[] = [];
  for (const line of lines) {
    const label = tagLabel(line.text);
    if (label !== null) {
      sections.push({ label, start: line.start, end: duration });
    } else if (sections.length === 0) {
      sections.push({ label: '', start: line.start, end: duration });
    }
  }
  if (sections.length === 0) return [];

  // A section ends where the next one starts; clamp the ends of the strip to the track.
  for (let i = 0; i < sections.length - 1; i++) sections[i].end = sections[i + 1].start;
  sections[0].start = 0;
  sections[sections.length - 1].end = duration;

  // Drop any zero/negative-width spans left by coincident tag times.
  return sections.filter((s) => s.end > s.start);
}
