/** The words a selection covers (PLAN.md "Editor Redesign", PR 7): which lyric sections it takes in, the stretch of the
 * lyrics text they are, and writing an edit of that stretch back into the whole text. Pure. */
import type { Section } from './lyricSections';
import type { LyricsBlock } from './lyricsBlocks';
import type { Region } from './Waveform';

export interface WordsSpan {
  /** Char offsets into the lyrics text: the covered blocks, without the first block's own `[Tag]` line. */
  start: number;
  end: number;
  /** `VERSE 2`, or `VERSE 2 – CHORUS 2` across several sections. */
  label: string;
}

/** Sections the selection takes in: a section at least half inside it, or the one section a smaller selection sits in. */
export function coveredSections(sections: Section[], selection: Region | null): number[] {
  if (!selection) return [];
  const out: number[] = [];
  sections.forEach((s, i) => {
    const overlap = Math.min(s.end, selection.end) - Math.max(s.start, selection.start);
    if (overlap > 0 && overlap >= 0.5 * Math.min(s.end - s.start, selection.end - selection.start)) out.push(i);
  });
  return out;
}

/** The stretch of text the covered sections' blocks span, or null when none of them matched a block. */
export function wordsSpan(text: string, matched: (LyricsBlock | null)[], covered: number[]): WordsSpan | null {
  const blocks = covered.map((i) => matched[i]).filter((b): b is LyricsBlock => !!b);
  if (blocks.length === 0) return null;
  const first = blocks.reduce((a, b) => (b.start < a.start ? b : a));
  const last = blocks.reduce((a, b) => (b.end > a.end ? b : a));
  const tagLine = text.slice(first.start).split('\n', 1)[0];
  const start = /^\s*\[[^\]]+\]\s*$/.test(tagLine) ? Math.min(first.start + tagLine.length + 1, first.end) : first.start;
  const name = (b: LyricsBlock) => (b.label || 'intro').toUpperCase();
  return { start, end: last.end, label: first === last ? name(first) : `${name(first)} – ${name(last)}` };
}

export const spanText = (text: string, span: WordsSpan) => text.slice(span.start, span.end);

/** The whole text with the span replaced by the edit. */
export function spliceWords(text: string, span: WordsSpan, edit: string): string {
  return text.slice(0, span.start) + edit + text.slice(span.end);
}
