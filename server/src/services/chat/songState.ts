/**
 * The song-state block of a turn's prompt (SP-5 prompt.py song_block): what the assistant knows about
 * where the person is. A draft thread: library titles, "no song yet" and the sidebar's fields as they
 * are now (CREATE SONG sends them). A song thread: title, versions with labels, header, key notes,
 * style, sections, lyric blocks and the bar map from yue-server's read (never the raw score), or the
 * reason the score cannot be read. Pure; songStateSource.ts gathers the input.
 */
import type { ScoreFacts } from '../score/planTypes.js';
import type { DraftFields } from './chatTypes.js';

/** Library titles told to the assistant (a reference song named by title, C3). */
export const LIBRARY_MAX = 50;

export interface VersionLine { number: number; label: string; active: boolean }
export interface SongInput {
  title: string;
  style: string;
  versions: VersionLine[];
  /** yue-server's read facts; null when the score cannot be read (`reason` says why). */
  facts: ScoreFacts | null;
  reason: string | null;
}
export interface SongStateInput { library: string[]; draft: DraftFields; song: SongInput | null }

/** The filled draft fields, one per line (SP-5 fmt_recipe), lyrics as "[Tag] line / line". */
export function fieldLines(f: DraftFields): string[] {
  const out: string[] = [];
  if (f.title) out.push(`title: ${f.title}`);
  if (f.style) out.push(`style: ${f.style}`);
  const meta = [f.bpm !== undefined ? `bpm ${f.bpm}` : '', f.key ? `key ${f.key}` : '', f.timeSignature ? `time ${f.timeSignature}` : '',
    f.language ? `language ${f.language}` : '', f.engine ? `engine ${f.engine}` : ''].filter(Boolean);
  if (meta.length) out.push(meta.join(' · '));
  if (f.structure?.length) out.push(`structure: ${f.structure.join(', ')}`);
  if (f.lyrics?.length) out.push('lyrics:', ...f.lyrics.map((s) => `[${s.tag}] ${s.lines.join(' / ')}`));
  return out;
}

function scoreLines(facts: ScoreFacts, style: string): string[] {
  const h = facts.header;
  const sections = facts.sections.map((s) => `S${s.index} ${s.label}: bars ${s.from_bar}-${s.to_bar}`).join('\n');
  const blocks = facts.lyric_blocks.map((b) => `${b.index}: ${b.tag} #${b.occurrence}, ${b.lines} lines`
    + (b.first_line ? `, first line: ${b.first_line}` : '')).join('\n');
  return [
    `HEADER: M:${h.meter} L:${h.unit} Q:1/4=${h.bpm} K:${h.key}; ${h.bars} bars, about ${Math.round(h.seconds)} s (the hard limit is 360 s)`,
    `KEY NOTES (${h.key}; the key signature already applies the sharps/flats): ${facts.key_notes}`,
    `STYLE: ${style}`,
    '',
    `SECTIONS:\n${sections || '(none marked)'}`,
    '',
    `LYRIC BLOCKS (block: tag #occurrence):\n${blocks || '(none)'}`,
    '',
    `BAR MAP (bar: chords@beat | vocal | number of Ins notes):\n${facts.bar_map.join('\n')}`,
  ];
}

function songLines(song: SongInput): string[] {
  const active = song.versions.find((v) => v.active) ?? song.versions.at(-1);
  const versions = song.versions.map((v) => `v${v.number} ${v.label || 'version'}${v.active ? ' (active)' : ''}`).join(' · ');
  const head = [
    `SONG: "${song.title}" · active v${active?.number ?? 1} of ${song.versions.length || 1} · engine YuE2`,
    `VERSIONS: ${versions || '(none)'}`,
  ];
  if (!song.facts) return [...head, `SCORE: cannot be read (${song.reason ?? 'unknown reason'})`, `STYLE: ${song.style}`];
  return [...head, ...scoreLines(song.facts, song.style)];
}

export function songStateLines({ library, draft, song }: SongStateInput): string[] {
  const lib = `LIBRARY (song titles): ${library.slice(0, LIBRARY_MAX).join('; ') || '(empty)'}`;
  if (song) return [lib, ...songLines(song)];
  const fields = fieldLines(draft);
  return [
    lib,
    'SONG: none yet (this thread is a draft; nothing has been created)',
    ...(fields.length ? ['SIDEBAR (the new-song fields as they are now; the person may have edited them by hand):', ...fields] : ['SIDEBAR: empty']),
  ];
}
