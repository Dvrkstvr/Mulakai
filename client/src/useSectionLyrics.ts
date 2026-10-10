import { useMemo } from 'react';
import type { Layer, SongDetail } from './api';
import type { Region } from './Waveform';
import { findActiveSectionIndex } from './lyricSections';
import { useLyricTiming } from './useLyricTiming';
import { splitLyricsBlocks, matchSectionBlocks } from './lyricsBlocks';
import { coveredSections, wordsSpan } from './sectionWords';

/** The song's sections, the one the selection sits in, and the lyrics block it maps to. */
export function useSectionLyrics(
  song: SongDetail | null,
  duration: number,
  selection: Region | null,
  lyricsDraft: string,
  focusedLayer: Layer | undefined,
  reload: () => Promise<void>,
) {
  // Section structure comes from the base layer's active render (the whole song),
  // not the focused layer — a focused stem shares the song's section timeline.
  const baseActive = song?.layers.find((l) => l.kind === 'base')?.versions.find((v) => v.active);
  const timing = useLyricTiming(song, baseActive, duration, reload);
  const sections = timing.sections;
  const activeSectionIndex = useMemo(() => findActiveSectionIndex(sections, selection), [sections, selection]);

  // Parsed from the live draft (not the stored song.lyrics) so block char-offsets
  // stay correct as the user edits — re-splitting on every keystroke is cheap at
  // lyric-text length, and it means highlighting a later block after editing an
  // earlier one doesn't drift out of sync with the shifted text.
  const lyricsBlocks = useMemo(() => splitLyricsBlocks(lyricsDraft), [lyricsDraft]);
  const matchedBlocks = useMemo(() => matchSectionBlocks(sections, lyricsBlocks), [sections, lyricsBlocks]);
  // The words the selection covers (PR 7): any range that takes in a heard section, not only an exact one.
  const words = useMemo(
    () => wordsSpan(lyricsDraft, matchedBlocks, coveredSections(sections, selection)),
    [lyricsDraft, matchedBlocks, sections, selection],
  );
  // Lyrics live on the song, not the layer — editing only makes sense (and
  // only gets sent as repaint conditioning) while repainting the base layer.
  const canEditLyrics = focusedLayer?.kind === 'base';
  const lyricsUnlocked = canEditLyrics && words !== null;
  return { timing, sections, activeSectionIndex, lyricsBlocks, matchedBlocks, words, lyricsUnlocked };
}
