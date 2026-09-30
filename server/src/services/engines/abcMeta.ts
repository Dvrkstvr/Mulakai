/**
 * Song metadata from an ABC score plan (YuE2's `score.abc`), per PLAN.md "Engine: YuE2"
 * › "ABC → song metadata". Only the header counts: the first `Q:`, `K:` and `M:` field
 * lines before the first line of music. A later field (a mid-tune meter change) is
 * ignored. Anything missing or unparseable is null / '' rather than guessed.
 */
import type { SongMeta } from './types.js';

const FIELD = /^([A-Za-z]):(.*)$/;
const MODES = new Set(['dor', 'phr', 'lyd', 'mix', 'aeo', 'loc', 'ion']);
const MINOR = new Set(['m', 'min', 'minor']);
const MAJOR = new Set(['', 'maj', 'major']);

/** songMeta.ts stores a meter as its numerator, for the four meters it offers. */
const METERS: Record<string, string> = { '2/4': '2', '3/4': '3', '4/4': '4', '6/8': '6', C: '4', 'C|': '2' };

function headerFields(score: string): Map<string, string> {
  const fields = new Map<string, string>();
  for (const raw of score.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('%')) continue;
    const match = FIELD.exec(line);
    if (!match) break; // the first line of music ends the header
    const key = match[1].toUpperCase();
    if (!fields.has(key)) fields.set(key, match[2].trim());
  }
  return fields;
}

/** `Q:1/4=120`, `Q:120` and `Q:"Allegro" 1/4=132` all give the trailing number. */
export function parseTempo(value: string | undefined): number | null {
  const match = /(\d+(?:\.\d+)?)$/.exec((value ?? '').replace(/"[^"]*"/g, '').trim());
  const bpm = match ? Math.round(Number(match[1])) : NaN;
  return bpm > 0 ? bpm : null;
}

/** `Am` → `A minor`, `F#min` → `F# minor`, `C` / `Cmaj` → `C major`; modes as written. */
export function parseKey(value: string | undefined): string {
  const tokens = (value ?? '').split(/\s+/).filter((t) => t && !t.includes('='));
  const match = /^([A-Ga-g])([#b]?)(.*)$/.exec(tokens[0] ?? '');
  if (!match) return '';
  const tonic = match[1].toUpperCase() + match[2];
  let mode = match[3].toLowerCase();
  if (!mode && tokens[1]) mode = tokens[1].toLowerCase();
  if (MINOR.has(mode)) return `${tonic} minor`;
  if (MAJOR.has(mode)) return `${tonic} major`;
  if (MODES.has(mode.slice(0, 3))) return tokens.slice(0, match[3] ? 1 : 2).join(' ');
  return '';
}

export function parseMeter(value: string | undefined): string {
  return METERS[(value ?? '').replace(/\s+/g, '')] ?? '';
}

export function readAbcMeta(score: string | undefined): SongMeta {
  const fields = headerFields(score ?? '');
  return {
    bpm: parseTempo(fields.get('Q')),
    keyScale: parseKey(fields.get('K')),
    timeSignature: parseMeter(fields.get('M')),
  };
}
