/** The Editor's hooks into SCORE: its state per song, reloaded when the song changes, and the picks the section
 * strip and the lyrics lane make while SCORE is the verb (F-032, M2-2: a pick under SCORE stays on SCORE). */
import { useEffect } from 'react';
import type { SongDetail } from './api';
import type { DockVerb } from './dockTarget';
import { findActiveSectionIndex, type Section } from './lyricSections';
import { lineIndexOf, linePick } from './scoreLinePick';
import { sectionPick, stripIndexOf } from './scoreReferent';
import { useScoreStore } from './scoreStore';
import { INITIAL_SCORE, type ScoreVerbState } from './scoreVerbTypes';
import type { Region } from './Waveform';

/** Changes whenever a layer or a version is added, removed or activated: SCORE re-evaluates then. */
export function scoreSongKey(song: SongDetail | null | undefined): string {
  return song?.layers.map((l) => `${l.id}:${l.versions.map((v) => `${v.id}${v.active ? '*' : ''}`).join(',')}`).join('|') ?? '';
}

/** The song's SCORE state, (re)loaded whenever `songKey` says the song changed ('' = not loaded yet).
 * `onSaved` runs once per render that saved a version, so the Editor shows it in VERSIONS. */
export function useScoreVerb(songId: string, songKey: string, onSaved?: () => void): ScoreVerbState {
  const load = useScoreStore((s) => s.load);
  useEffect(() => { if (songKey) void load(songId); }, [load, songId, songKey]);
  const state = useScoreStore((s) => s.bySong[songId] ?? INITIAL_SCORE);
  const saved = state.phase.kind === 'done' ? state.phase.saved : '';
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (saved) onSaved?.(); }, [saved]);
  return state;
}

export interface ScorePickInputs {
  /** The strip segment and lyric line (draft index) the pick stands on, for their sky echo; -1 for none. */
  stripIndex: number;
  lineIndex: number;
  onStrip: (region: Region) => void;
  onLine: (index: number) => void;
}

/** Under SCORE: a strip section or a lyric line becomes the pick, the verb stays; null under any other verb. */
export function useScorePick(songId: string, verb: DockVerb, strip: Section[], draft: string, score: ScoreVerbState): ScorePickInputs | null {
  const dispatch = useScoreStore((s) => s.dispatch);
  if (verb !== 'score') return null;
  const sections = score.status?.sections;
  const blocks = score.status?.blocks;
  return {
    stripIndex: stripIndexOf(strip, sections, score.pick),
    lineIndex: lineIndexOf(draft, score.pick, blocks),
    onStrip: (region) => {
      const pick = sectionPick(strip, findActiveSectionIndex(strip, region), sections);
      if (pick) dispatch(songId, { type: 'pick', pick });
    },
    onLine: (index) => {
      const pick = linePick(draft, index, blocks);
      if (pick) dispatch(songId, { type: 'pick', pick });
    },
  };
}
