import { useMemo } from 'react';
import type { Layer, SongDetail } from './api';
import type { Region } from './Waveform';
import { groupSections, findActiveSectionIndex } from './lyricSections';
import { splitLyricsBlocks, matchSectionBlocks } from './lyricsBlocks';

/** The song's sections, the one the selection sits in, and the lyrics block it maps to. */
export function useSectionLyrics(
  song: SongDetail | null,
  duration: number,
  selection: Region | null,
  lyricsDraft: string,
  focusedLayer: Layer | undefined,
) {
  // Section structure comes from the base layer's active render (the whole song),
  // not the focused layer — a focused stem shares the song's section timeline.
  const baseActive = song?.layers.find((l) => l.kind === 'base')?.versions.find((v) => v.active);
  const sections = useMemo(
    () => groupSections(baseActive?.lyricTimestamps, duration),
    [baseActive, duration],
  );
  const activeSectionIndex = useMemo(() => findActiveSectionIndex(sections, selection), [sections, selection]);

  // Parsed from the live draft (not the stored song.lyrics) so block char-offsets
  // stay correct as the user edits — re-splitting on every keystroke is cheap at
  // lyric-text length, and it means highlighting a later block after editing an
  // earlier one doesn't drift out of sync with the shifted text.
  const lyricsBlocks = useMemo(() => splitLyricsBlocks(lyricsDraft), [lyricsDraft]);
  const matchedBlocks = useMemo(() => matchSectionBlocks(sections, lyricsBlocks), [sections, lyricsBlocks]);
  const activeLyricsBlock = activeSectionIndex !== -1 ? matchedBlocks[activeSectionIndex] : null;
  // Lyrics live on the song, not the layer — editing only makes sense (and
  // only gets sent as repaint conditioning) while repainting the base layer.
  const canEditLyrics = focusedLayer?.kind === 'base';
  const lyricsUnlocked = canEditLyrics && activeSectionIndex !== -1;
  return { sections, activeSectionIndex, lyricsBlocks, activeLyricsBlock, lyricsUnlocked };
}
