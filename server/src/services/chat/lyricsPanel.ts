/**
 * The lyrics panel's data, `shown.lyrics` of the analysis view (F-056, D-217, D-218), pure, computed at read time
 * from the shown reading and the version's stored lyrics: one panel section per strip section (the strip's own
 * order, bars and seconds). A YuE2 version (`own` score) sings its stored lyrics: split into blocks
 * (`lyricsSplit`), checked against the read's `lyric_blocks` (D-072) and paired with the sections by the one rule
 * (`lyricPairing`); each line carries its index in `text` for the client's `alignLyrics`. A transcribed version
 * lists the heard lines (word-timing segments) inside each section's seconds, a line across an edge in both
 * (as the strip counts it). No words or a mismatch: source `none`, a note saying why, the sections without lines.
 */
import type { LyricsReading } from '../lyricsClient.js';
import { pairBlocks } from '../score/lyricPairing.js';
import type { ScoreFacts } from '../score/planTypes.js';
import type { LyricsPanel, PanelLine, PanelSection } from './convergeTypes.js';
import { isRead } from './reading.js';
import { checkBlocks, splitLyrics } from './lyricsSplit.js';
import type { StripSection, VersionAnalysis } from './analysisTypes.js';

export interface PanelInput {
  /** The shown reading (current, or the older dim / hatched one). */
  analysis: VersionAnalysis;
  /** Its strip sections (`stripSections`): cut to the audio, with seconds when the bars were read. */
  sections: StripSection[];
  /** The shown version's word timings (`versions.word_timings`). */
  words: LyricsReading | null;
  /** The shown version's `params_json.request.lyrics` and `request.style`. */
  lyrics: string | null;
  style: string | null;
}

const section = (s: StripSection, block: number | null, lines: PanelLine[]): PanelSection =>
  ({ strip: s.index, label: s.label, occurrence: s.occurrence, bars: s.bars, seconds: s.seconds, block, lines });

function blockLines(input: PanelInput, facts: ScoreFacts, sung: Map<number, number>): LyricsPanel['sections'] | string {
  const text = (input.lyrics ?? '').replace(/\r\n/g, '\n');
  const blocks = splitLyrics(text);
  const bad = checkBlocks(blocks, facts.lyric_blocks);
  if (bad) return `the stored lyrics do not match the score's (${bad}): read the song again`;
  return input.sections.map((s) => {
    const b = sung.get(s.index);
    const lines = blocks.find((x) => x.index === b)?.lines ?? [];
    return section(s, b ?? null, lines.map((l, i) => ({ n: i + 1, text: l.text, at: { textLine: l.textLine } })));
  });
}

function heardLines(sections: StripSection[], words: LyricsReading): PanelSection[] {
  return sections.map((s) => {
    const inside = s.seconds ? words.segments.filter((w) => w.start < s.seconds![1] && w.end > s.seconds![0]) : [];
    return section(s, null, inside.map((w, i) => ({ n: i + 1, text: w.text.trim(), at: { seconds: [w.start, w.end] } })));
  });
}

function heardNote(a: VersionAnalysis, words: LyricsReading | null): string | null {
  if (isRead(a.words) && a.words.instrumental) return 'heard as instrumental: no words in this version';
  if (words && words.segments.length > 0) return null;
  if (!isRead(a.words)) return `the words are not read: ${a.words.notRead}`;
  return words ? 'no words were heard in this version' : 'the words are not timed: read the song again';
}

export function lyricsPanel(input: PanelInput): LyricsPanel {
  const a = input.analysis;
  const score = isRead(a.score) ? a.score : null;
  const facts = score?.facts ?? null;
  if (!score || !facts) {
    const why = isRead(a.score) ? 'the score does not parse' : `the score is not read: ${a.score.notRead}`;
    return { source: 'none', note: why, text: null, facts: null, sections: [] };
  }
  const header = { bpm: facts.header.bpm, key: facts.header.key, meter: facts.header.meter, style: input.style };
  const sung = pairBlocks(facts.sections, facts.lyric_blocks);
  const none = (note: string): LyricsPanel => ({
    source: 'none', note, text: null, facts: header, sections: input.sections.map((s) => section(s, sung.get(s.index) ?? null, [])),
  });
  if (score.source === 'transcribed') {
    const note = heardNote(a, input.words);
    if (note !== null || !input.words) return none(note ?? 'the words are not timed: read the song again');
    return { source: 'heard', note: null, text: null, facts: header, sections: heardLines(input.sections, input.words) };
  }
  if (facts.lyric_blocks.length === 0) return none('no lyrics in this version');
  if (!input.lyrics?.trim()) return none("this version's lyrics are not stored: ask the chat for new ones");
  const sections = blockLines(input, facts, sung);
  if (typeof sections === 'string') return none(sections);
  return { source: 'blocks', note: null, text: input.lyrics.replace(/\r\n/g, '\n'), facts: header, sections };
}
