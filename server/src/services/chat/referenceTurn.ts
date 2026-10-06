/**
 * What a reference adds to a turn (architecture "Chat (C3)" flow 2, 5), pure: an `ATTACHED:` line for
 * a file not read yet, the REFERENCE block for a reading (≤ 1,800 characters: name, what was read,
 * tempo / key / meter with their source, caption, words, sections with bars, line counts and the first
 * sung line, cover possible or why; the sections are cut per section to fit), and the READ card's body.
 */
import { readSpan, readingEstimate } from './referenceRules.js';
import { coverVerdict, isRead, readingFacts, type FactField, type Reading, type ReadingPlanSources } from './reading.js';
import { sectionTag } from './referenceRecipe.js';
import type { AnalyzeBody, AnalyzeTarget } from './chatTypes.js';

export const REFERENCE_MAX = 1800;
const CAPTION_MAX = 240;
const FIRST_MAX = 60;

const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);
export function clock(seconds: number): string {
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export const attachedLine = (r: { name: string; seconds: number | null }) =>
  `ATTACHED: "${r.name}" (${r.seconds === null ? 'length unknown' : clock(r.seconds)}, not read yet)`;

function factsLine(reading: Reading): string {
  const f = readingFacts(reading);
  const one = (field: FactField, label: string, unit = '') =>
    (f[field] === null ? `${label} not found` : `${label} ${f[field]}${unit} (${f.sources[field]})`);
  return [one('bpm', 'tempo', ' bpm'), one('key', 'key'), one('meter', 'meter')].join(' · ');
}

function wordsLine(reading: Reading): string {
  const w = reading.words;
  if (!isRead(w)) return `WORDS: not read: ${w.notRead}`;
  if (w.instrumental || !w.lines.length) return 'WORDS: none, an instrumental';
  return `WORDS: language ${w.language ?? 'unknown'}, ${w.lines.length} lines; first: ${cut(w.lines[0], FIRST_MAX)}`;
}

/** One line per section; `withWords` adds its lyric block's line count and first line (matched by tag and occurrence). */
function sectionLines(reading: Reading, withWords: boolean): string[] {
  const facts = isRead(reading.score) ? reading.score.facts : null;
  if (!facts) return [];
  const seen: Record<string, number> = {};
  return facts.sections.map((s) => {
    const tag = sectionTag(s.label);
    seen[tag] = (seen[tag] ?? 0) + 1;
    const block = withWords ? facts.lyric_blocks.find((b) => sectionTag(b.tag) === tag && b.occurrence === seen[tag]) : undefined;
    const words = block ? `, ${block.lines} lines, first: ${cut(block.first_line, FIRST_MAX)}` : '';
    return `S${s.index} ${s.label}: bars ${s.from_bar}-${s.to_bar}${words}`;
  });
}

function sectionsHead(reading: Reading): string {
  const s = reading.score;
  if (!isRead(s)) return `SECTIONS: not read: ${s.notRead}`;
  if (!s.facts) return 'SECTIONS: the score does not parse';
  const chords = s.chords === null ? 'chords unknown' : s.chords ? 'with chords' : 'no chords';
  return `SECTIONS (${s.source === 'own' ? 'its own score' : 'transcribed score'}, ${s.facts.header.bars} bars, ${chords}):`;
}

export function referenceBlock(name: string, reading: Reading): string[] {
  const of = reading.seconds === null ? 'of unknown length' : `of ${clock(reading.seconds)}`;
  const read = `read 0:00-${clock(reading.readTo)} ${of}${reading.cut ? ` (only the first ${clock(reading.readTo)} is read)` : ''}`;
  const verdict = coverVerdict(reading);
  const head = [
    `REFERENCE: "${cut(name, 120)}", ${read}`,
    factsLine(reading),
    isRead(reading.caption) ? `CAPTION: ${cut(reading.caption.caption || '(empty)', CAPTION_MAX)}` : `CAPTION: not read: ${reading.caption.notRead}`,
    wordsLine(reading),
    sectionsHead(reading),
  ];
  const tail = verdict.ok ? 'COVER: possible' : `COVER: not possible (${verdict.reason})`;
  const room = REFERENCE_MAX - [...head, tail].join('\n').length - 1;
  const size = (lines: string[]) => lines.reduce((n, l) => n + l.length + 1, 0);
  let sections = sectionLines(reading, true);
  if (size(sections) > room) sections = sectionLines(reading, false);
  if (size(sections) > room) {
    const total = sections.length;
    const more = (n: number) => `(… ${n} more sections)`;
    while (sections.length && size(sections) + more(total - sections.length).length + 1 > room) sections = sections.slice(0, -1);
    sections.push(more(total - sections.length));
  }
  return [...head, ...sections, tail];
}

/** The READ card: what will be read, the cut (D-138) and the GPU seconds (referenceRules). */
export function analyzeBody(target: AnalyzeTarget, info: { name: string; seconds: number | null }, plan: ReadingPlanSources): AnalyzeBody {
  const span = readSpan(info.seconds);
  return { target, name: info.name, seconds: info.seconds, readTo: span.to, cut: span.cut, estimate: readingEstimate(plan, info.seconds) };
}
