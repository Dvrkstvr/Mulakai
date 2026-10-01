/** READ LYRICS' placement (PLAN.md "READ LYRICS on COVER · YUE2", spike decision 2): each line
 * the reader heard goes under the score section it was sung in, by time, not by order. Pure. */
import type { LyricSegment, Transcription } from './api';
import { scoreSections } from './coverLyrics';
import { splitScore } from './scoreCut';

const REST = /^Z([2-4])?$/;

/** Bars per `% name` section, counted from its Vocal lines by the rules yue-server's
 * sections.py and the vendored parser use (`Z2`–`Z4` are several bars of rest). */
export function sectionBarCounts(abc: string): number[] {
  return splitScore(abc).sections.map(({ text }) => {
    let voice = '';
    let bars = 0;
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trimEnd();
      if (line.startsWith('V:')) voice = line.slice(2).trim().split(/\s+/)[0] ?? '';
      else if (voice === 'Vocal' && line.endsWith('|')) {
        for (const measure of line.slice(0, -1).split('|').map((m) => m.trim())) {
          const rest = REST.exec(measure);
          bars += rest ? Number(rest[1] ?? 1) : measure ? 1 : 0;
        }
      }
    }
    return bars;
  });
}

function barSeconds(abc: string): number | null {
  const tempo = /^Q:1\/4=(\d+)/m.exec(abc);
  const meter = /^M:(\d+)\/(\d+)/m.exec(abc);
  return tempo && meter ? ((Number(meter[1]) * 4) / Number(meter[2]) * 60) / Number(tempo[1]) : null;
}

export interface SectionTimes {
  starts: number[];
  /** From the score's tempo grid, not the source's downbeats: can run a bar or more off. */
  estimated: boolean;
}

/** Each section's start in seconds: the transcription's downbeat times when they describe this
 * score's sections, else the score's tempo grid from 0 s. Null when neither can be had. */
export function sectionTimes(abc: string, transcription: Transcription | null): SectionTimes | null {
  const names = scoreSections(abc);
  if (!names.length) return null;
  const given = transcription?.sectionStarts;
  if (given?.length === names.length && given.every((s, i) => s.label.toLowerCase() === names[i].toLowerCase())) {
    return { starts: given.map((s) => s.seconds), estimated: false };
  }
  const bar = barSeconds(abc);
  if (!bar) return null;
  let at = 0;
  const starts = sectionBarCounts(abc).map((bars) => {
    const start = Math.round(at * bar * 100) / 100; // to 0.01 s, as yue-server rounds its own
    at += bars;
    return start;
  });
  return { starts, estimated: true };
}

/** When a line was sung: the median of its words' midpoints, so a first line whose start
 * swallowed the intro still lands where it is sung. */
export function lineTime(segment: LyricSegment): number {
  const mids = segment.words.map((w) => (w.start + w.end) / 2).sort((a, b) => a - b);
  return mids.length ? mids[Math.floor(mids.length / 2)] : (segment.start + segment.end) / 2;
}

/** The last section starting at or before `t`; a line before the first section goes under it.
 * Sections with no bars share their successor's start, and the successor wins. */
function sectionAt(t: number, starts: number[]): number {
  let at = 0;
  starts.forEach((start, i) => { if (t >= start) at = i; });
  return at;
}

export interface CoverScoreLike {
  abc: string;
  dropped?: number[];
  transcription: Transcription | null;
}

export interface Placement {
  lyrics: string;
  /** Lines in LYRICS. */
  lines: number;
  /** Lines that fell in a section left out of the cover. */
  leftOut: number;
  /** Placed by tag at all: false with no score yet, or one whose sections can't be timed. */
  placed: boolean;
  estimated: boolean;
}

/** LYRICS from a reading: placed over the whole score's sections, then the sections left out
 * are removed, so the tags match what will be sung (`sungScore`). */
export function placeReading(segments: LyricSegment[], score: CoverScoreLike | null): Placement {
  const lines = segments.map((s) => ({ text: s.text.trim(), at: lineTime(s) })).filter((l) => l.text);
  const times = score ? sectionTimes(score.abc, score.transcription) : null;
  if (!score || !times) {
    return { lyrics: lines.map((l) => l.text).join('\n'), lines: lines.length, leftOut: 0, placed: false, estimated: false };
  }
  const names = scoreSections(score.abc);
  const body: string[][] = names.map(() => []);
  for (const line of lines) body[sectionAt(line.at, times.starts)].push(line.text);
  const dropped = score.dropped ?? [];
  const kept = names.map((_, i) => i).filter((i) => !dropped.includes(i));
  const leftOut = dropped.reduce((n, i) => n + (body[i]?.length ?? 0), 0);
  return {
    lyrics: kept.map((i) => [`[${names[i]}]`, ...body[i]].join('\n')).join('\n\n'),
    lines: lines.length - leftOut, leftOut, placed: true, estimated: times.estimated,
  };
}
