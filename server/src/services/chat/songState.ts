/**
 * The song-state block of a turn's prompt (SP-5 prompt.py song_block, v3.1 + run-length bar map):
 * what the assistant knows about where the person is. A draft thread: library titles and "no song
 * yet". A song thread: title, versions with labels, the HEADER with the key in words, key notes, the
 * style without the app's tempo/key hints, sections, lyric blocks and the run-length bar map from
 * yue-server's read (never the raw score), or the reason the score cannot be read. The draft's
 * fields go in as the pending proposal (draftLines). Pure; songStateSource.ts gathers the input.
 */
import type { ScoreFacts } from '../score/planTypes.js';
import { cleanStyle, keyWords, rleBarMap } from './songStateText.js';
import type { DraftFields } from './chatTypes.js';

/** Library titles told to the assistant (a reference song named by title, C3). */
export const LIBRARY_MAX = 50;
/** SP-5 RESULT item 5: a pending plan is at most 1.2k tokens (3 characters a token). */
export const PENDING_MAX = 3600;

export interface VersionLine { number: number; label: string; active: boolean }
export interface SongInput {
  title: string;
  style: string;
  versions: VersionLine[];
  /** yue-server's read facts; null when the score cannot be read (`reason` says why). */
  facts: ScoreFacts | null;
  reason: string | null;
}
export interface SongStateInput { library: string[]; song: SongInput | null }

/** The filled draft fields, one per line (SP-5 fmt_recipe), lyrics as "[Tag] line / line". */
export function fieldLines(f: DraftFields): string[] {
  const out: string[] = [];
  if (f.title) out.push(`title: ${f.title}`);
  if (f.style) out.push(`style: ${f.style}`);
  const meta = [f.bpm !== undefined ? `bpm ${f.bpm}` : '', f.key ? `key ${f.key}` : '', f.timeSignature ? `time ${f.timeSignature}` : '',
    f.language ? `language ${f.language}` : '', f.engine ? `engine ${f.engine}` : ''].filter(Boolean);
  if (meta.length) out.push(meta.join(' · '));
  if (f.structure?.length) out.push(`structure: ${f.structure.join(', ')}`);
  if (f.vocals === 'instrumental') out.push('vocals: instrumental (no lyrics)'); // F-097: sung is the default, unsaid
  if (f.lyrics?.length) out.push('lyrics:', ...f.lyrics.map((s) => `[${s.tag}] ${s.lines.join(' / ')}`));
  return out;
}

/** The draft thread's fields in the prompt: the live recipe card as the PENDING PROPOSAL (SP-5
 * fmt_pending; the fields include the person's hand edits), else the sidebar as it is; none when empty. */
export function draftLines(fields: DraftFields | null, live: boolean): string[] {
  const lines = fields ? fieldLines(fields) : [];
  if (!lines.length) return [];
  const head = live ? 'PENDING PROPOSAL (the new-song card the person is looking at; nothing has run):'
    : 'SIDEBAR (the new-song fields as they are now; the person may have edited them by hand):';
  const text = [head, ...lines].join('\n');
  return (text.length > PENDING_MAX ? `${text.slice(0, PENDING_MAX)}…` : text).split('\n');
}

function scoreLines(facts: ScoreFacts, style: string): string[] {
  const h = facts.header;
  const sections = facts.sections.map((s) => `S${s.index} ${s.label}: bars ${s.from_bar}-${s.to_bar}`).join('\n');
  const blocks = facts.lyric_blocks.map((b) => `${b.index}: ${b.tag} #${b.occurrence}, ${b.lines} lines`
    + (b.first_line ? `, first line: ${b.first_line}` : '')).join('\n');
  return [
    `HEADER: M:${h.meter} L:${h.unit} Q:1/4=${h.bpm} K:${h.key}${keyWords(h.key)}; ${h.bars} bars, about ${Math.round(h.seconds)} s (the hard limit is 360 s)`,
    `KEY NOTES (${h.key}; the key signature already applies the sharps/flats): ${facts.key_notes}`,
    `STYLE (a description only; its bpm or key words may be stale, the HEADER is true): ${cleanStyle(style)}`,
    '',
    `SECTIONS:\n${sections || '(none marked)'}`,
    '',
    `LYRIC BLOCKS (block: tag #occurrence):\n${blocks || '(none)'}`,
    '',
    `BAR MAP (bar: chords@beat | vocal | number of Ins notes; "a-b:" = the same for every bar a to b):\n${rleBarMap(facts.bar_map).join('\n')}`,
  ];
}

function songLines(song: SongInput): string[] {
  const active = song.versions.find((v) => v.active) ?? song.versions.at(-1);
  const versions = song.versions.map((v) => `v${v.number} ${v.label || 'version'}${v.active ? ' (active)' : ''}`).join(' · ');
  const head = [
    `SONG: "${song.title}" · active v${active?.number ?? 1} of ${song.versions.length || 1}${song.facts ? ' · engine YuE2 (score-editable)' : ''}`,
    `VERSIONS: ${versions || '(none)'}`,
  ];
  if (!song.facts) return [...head, `SCORE: cannot be read (${song.reason ?? 'unknown reason'})`, `STYLE: ${cleanStyle(song.style)}`];
  return [...head, ...scoreLines(song.facts, song.style)];
}

export function songStateLines({ library, song }: SongStateInput): string[] {
  const lib = `LIBRARY (song titles): ${library.slice(0, LIBRARY_MAX).join('; ') || '(empty)'}`;
  return song ? [lib, ...songLines(song)] : [lib, 'SONG: none yet (this thread is a draft; nothing has been created)'];
}
