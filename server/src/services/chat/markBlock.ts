/**
 * The MARK block (F-055 #1, D-177, D-179): a pinned mark + the playable version's analysis -> the prompt lines
 * after the song state, and WHAT IT SEES (plain rows + the AS SENT object), all from one `sent` object so the
 * chip shows exactly what the turn sends. Sections come from the version's analysis (strip sections, partial
 * ones with the bars inside the mark); lyrics from the word timings inside the seconds, else the lyric blocks
 * those sections sing; key, tempo and meter from the analysis' score header. With no bar times the mark is a
 * time only: "bars not read", no bars sent, and the turn answers in words (D-194: no edit card until the reading
 * lands); a seconds-only mark on a version whose bar times are read was snapped to bars before (markSnap). Pure.
 */
import type { LyricsReading } from '../lyricsClient.js';
import type { ScoreFacts } from '../score/planTypes.js';
import { isRead } from './reading.js';
import { stripSections } from './analysisView.js';
import type { MarkPreview, RangeMark, StripSection, VersionAnalysis } from './analysisTypes.js';

export interface MarkBlockInput { mark: RangeMark; number: number; analysis: VersionAnalysis | null; words: LyricsReading | null }
export interface MarkedSection { section: number; label: string; occurrence: number; bars: [number, number]; whole: boolean }
export interface MarkSent {
  version: number;
  versionId: string;
  bars: [number, number] | null;
  seconds: [number, number];
  sections: MarkedSection[];
  lyrics: string[];
  key: string | null;
  bpm: number | null;
  meter: string | null;
}
export interface MarkBlock { lines: string[]; preview: MarkPreview; bars: [number, number] | null; sent: MarkSent }

const LYRICS_MAX = 12;
const MEANS = '"this", "here" and "it" in the REQUEST mean it';
const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const time = ([a, b]: [number, number]) => `${clock(a)}-${clock(b)}`;
const kindOf = (tag: string) => tag.toLowerCase().split(' ')[0].replace(/^[[\]:]+|[[\]:]+$/g, '');

function marked(sections: StripSection[], [a, b]: [number, number]): MarkedSection[] {
  return sections.filter((s) => s.bars[1] >= a && s.bars[0] <= b).map((s) => {
    const bars: [number, number] = [Math.max(a, s.bars[0]), Math.min(b, s.bars[1])];
    return { section: s.index, label: s.label, occurrence: s.occurrence, bars, whole: bars[0] === s.bars[0] && bars[1] === s.bars[1] };
  });
}

/** The lyric blocks the marked sections sing: the k-th section of a kind sings the k-th block of it (D-066 d). */
function blockLyrics(facts: ScoreFacts, sections: MarkedSection[]): string[] {
  return sections.flatMap((m) => {
    const kind = kindOf(m.label);
    const k = facts.sections.filter((s) => kindOf(s.label) === kind).findIndex((s) => s.index === m.section);
    const b = facts.lyric_blocks.filter((x) => kindOf(x.tag) === kind)[k];
    return b ? [`${b.tag} #${b.occurrence}, ${b.lines} lines${b.first_line ? `, first line: ${b.first_line}` : ''}`] : [];
  });
}

function wordLyrics(words: LyricsReading, [a, b]: [number, number]): string[] {
  return words.segments.filter((w) => w.start < b && w.end > a)
    .map((w) => `${JSON.stringify(w.text.trim())}${w.start < a || w.end > b ? ' (partly)' : ''}`);
}

export function markBlock({ mark, number, analysis, words }: MarkBlockInput): MarkBlock {
  const facts = analysis && isRead(analysis.score) ? analysis.score.facts : null;
  const times = analysis && isRead(analysis.bars) ? { starts: analysis.bars.starts, end: analysis.bars.end } : null;
  const bars = mark.bars && (times || !analysis) ? mark.bars : null; // D-179: no bar times read → no bars sent
  const sections = facts && bars ? marked(stripSections(facts, times, null), bars) : [];
  const lyrics = (words ? wordLyrics(words, mark.seconds) : facts ? blockLyrics(facts, sections) : []).slice(0, LYRICS_MAX);
  const h = facts?.header;
  const sent: MarkSent = {
    version: number, versionId: mark.versionId, bars, seconds: mark.seconds, sections, lyrics,
    key: h?.key ?? null, bpm: h?.bpm ?? null, meter: h?.meter ?? null,
  };
  const where = bars ? `bars ${bars[0]}-${bars[1]}, ${time(mark.seconds)}` : `${time(mark.seconds)}, bars not read`;
  const sectionLine = (s: MarkedSection) => {
    const full = facts!.sections.find((x) => x.index === s.section)!;
    return `S${s.section} ${s.label} #${s.occurrence} bars ${full.from_bar}-${full.to_bar} (${s.whole ? 'whole' : `partly: bars ${s.bars[0]}-${s.bars[1]}`})`;
  };
  const lines = [
    `MARK (the person marked part of v${number} on the player; ${MEANS}): ${where}.`,
    `MARKED SECTIONS: ${facts && bars ? sections.map(sectionLine).join('; ') || 'none' : 'not read'}`,
    `MARKED LYRICS: ${lyrics.join(' / ') || 'none read'}`,
    h ? `AT THE MARK: key ${h.key} · ${h.bpm} BPM · ${h.meter}` : 'AT THE MARK: key and tempo not read',
    bars ? `Plan ops only inside bars ${bars[0]}-${bars[1]}; a tempo, key or style op changes the whole song: use one only when the person asks for the whole song.`
      : 'The bars of this version were not read yet: the mark is a time only, so no edit can be planned for it; answer in words (say) and tell the person to mark again once the reading lands.',
  ];
  const sectionRow = facts && bars ? sections.map((s) => `${s.label.toUpperCase()} ${s.occurrence} (${s.whole ? 'whole' : `bars ${s.bars[0]}-${s.bars[1]}`})`).join(', ') || 'none' : 'not read';
  const rows = [
    { name: 'VERSION', value: `v${number}` }, { name: 'BARS', value: bars ? `${bars[0]}-${bars[1]}` : 'not read' },
    { name: 'TIME', value: time(mark.seconds) }, { name: 'SECTIONS', value: sectionRow },
    { name: 'LYRICS', value: lyrics.join(' / ') || 'none read' },
    { name: 'KEY', value: h?.key ?? 'not read' }, { name: 'TEMPO', value: h ? `${h.bpm} BPM` : 'not read' }, { name: 'METER', value: h?.meter ?? 'not read' },
  ];
  return { lines, preview: { rows, sent }, bars, sent };
}
