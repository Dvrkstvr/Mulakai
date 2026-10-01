import { describe, it, expect } from 'vitest';
import type { LyricSegment, Transcription } from './api';
import { lineTime, placeReading, sectionBarCounts, sectionTimes } from './lyricsPlacement';

const HEADER = 'X:1\nT:\nM:4/4\nL:1/16\nQ:1/4=75\nV: Vocal clef=treble name="Vocal Melody" snm="Vocal"\nV: Ins clef=treble name="Ins Melody" snm="Inst."\nK:Fm\n';
/** Ellies City 2's layout at 75 BPM (3.2 s bars): intro 4 bars, verse 8, chorus 6, outro 2. */
const ABC = `${HEADER}% intro\nV: Vocal\nZ3|z16|\nV: Ins\nZ4|\n% verse\nV: Vocal\nZ4|\nV: Ins\nZ4|\nV: Vocal\nZ4|\nV: Ins\nZ4|\n`
  + `% chorus\nV: Vocal\nZ4|\nV: Ins\nZ4|\nV: Vocal\nZ2|\nV: Ins\nZ2|\n% outro\nV: Vocal\nZ2|\nV: Ins\nZ2|\n`;
/** The audio's own downbeats, a little off the tempo grid. */
const STARTS = [{ label: 'intro', bar: 0, seconds: 0.01 }, { label: 'verse', bar: 4, seconds: 12.85 },
  { label: 'chorus', bar: 12, seconds: 38.45 }, { label: 'outro', bar: 18, seconds: 57.65 }];
const T = { sectionStarts: STARTS } as Transcription;

const seg = (text: string, start: number, end: number, words = true): LyricSegment => ({
  text: ` ${text}`, start, end,
  words: words ? text.split(' ').map((w, i, all) => {
    const step = (end - start) / all.length;
    return { text: w, start: start + i * step, end: start + (i + 1) * step };
  }) : [],
});

describe('sectionBarCounts', () => {
  it('counts Vocal measures per section with rests expanded', () => {
    expect(sectionBarCounts(ABC)).toEqual([4, 8, 6, 2]);
  });
});

describe('sectionTimes', () => {
  it("uses the transcription's downbeat times when they describe this score", () => {
    expect(sectionTimes(ABC, T)).toEqual({ starts: [0.01, 12.85, 38.45, 57.65], estimated: false });
  });

  it('falls back to the tempo grid from 0 s for a score without them, or for another score', () => {
    const grid = { starts: [0, 12.8, 38.4, 57.6], estimated: true };
    expect(sectionTimes(ABC, null)).toEqual(grid);
    expect(sectionTimes(ABC, { sectionStarts: STARTS.slice(0, 3) } as Transcription)).toEqual(grid);
    expect(sectionTimes(ABC, { sectionStarts: STARTS.map((s) => ({ ...s, label: 'verse' })) } as Transcription)).toEqual(grid);
  });

  it('is null without sections or a tempo', () => {
    expect(sectionTimes(`${HEADER}V: Vocal\nZ|\n`, null)).toBeNull();
    expect(sectionTimes(ABC.replace('Q:1/4=75\n', ''), null)).toBeNull();
  });
});

describe('lineTime', () => {
  it("is the median word, so a first line that swallowed the intro lands where it's sung", () => {
    const first = seg('Leg die KI in die Tüte', 0, 15.3);
    first.words[0] = { text: 'Leg', start: 0, end: 12.3 }; // the reader's start absorbed 12 s of intro
    first.words.slice(1).forEach((w, i) => { w.start = 12.3 + i * 0.6; w.end = w.start + 0.6; });
    expect(lineTime(first)).toBeGreaterThan(12.85);
    expect(lineTime(seg('no words', 10, 20, false))).toBe(15);
  });
});

describe('placeReading', () => {
  const segments = [
    seg('Midnight city streets are wet', 13.0, 16.0),
    seg('Lost inside this purple haze', 33.0, 36.5),
    seg('In the shadows we exist', 38.2, 41.0), // a pickup: starts just before the chorus downbeat
    seg('Anonymous and free', 47.0, 49.0),
    seg('In the shadows', 60.0, 62.0),
  ];

  it('puts each line under the section it was sung in, by time', () => {
    expect(placeReading(segments, { abc: ABC, transcription: T })).toEqual({
      lyrics: '[Intro]\n\n[Verse]\nMidnight city streets are wet\nLost inside this purple haze\n\n'
        + '[Chorus]\nIn the shadows we exist\nAnonymous and free\n\n[Outro]\nIn the shadows',
      lines: 5, leftOut: 0, placed: true, estimated: false,
    });
  });

  it("leaves out the sections the cover drops, counting their lines", () => {
    const p = placeReading(segments, { abc: ABC, transcription: T, dropped: [3] });
    expect(p.lyrics.endsWith('[Chorus]\nIn the shadows we exist\nAnonymous and free')).toBe(true);
    expect(p).toMatchObject({ lines: 4, leftOut: 1 });
  });

  it('says when the times were estimated from the tempo grid', () => {
    expect(placeReading(segments, { abc: ABC, transcription: null }).estimated).toBe(true);
  });

  it('gives untagged lines with no score yet', () => {
    expect(placeReading(segments.slice(0, 2), null)).toEqual({
      lyrics: 'Midnight city streets are wet\nLost inside this purple haze', lines: 2, leftOut: 0, placed: false, estimated: false,
    });
  });

  it('skips empty segments and puts words heard before the first section under it', () => {
    const p = placeReading([seg('Hey', -1, -0.5), { text: '  ', start: 5, end: 6, words: [] }], { abc: ABC, transcription: T });
    expect(p.lyrics.startsWith('[Intro]\nHey\n\n[Verse]')).toBe(true);
    expect(p.lines).toBe(1);
  });
});
