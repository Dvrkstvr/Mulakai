/** What COVER's review panel says about a score (PLAN.md "Client cover decisions"): tempo,
 * key and meter from the ABC header (the same rules as the server's abcMeta.ts), plus the
 * bar count and a nominal length from the `Vocal` voice's bar lines. Pure; anything missing
 * or unreadable is null / '' rather than guessed. */

export interface AbcFacts {
  bpm: number | null;
  /** `F minor`, `C major`, or a mode as written (`D dor`). */
  key: string;
  /** As written, e.g. `4/4`. */
  meter: string;
  bars: number | null;
  /** bars × beats per bar at the header tempo; ignores mid-song tempo or meter changes. */
  seconds: number | null;
}

const FIELD = /^([A-Za-z]):(.*)$/;
const MODES = new Set(['dor', 'phr', 'lyd', 'mix', 'aeo', 'loc', 'ion']);

function header(abc: string): Map<string, string> {
  const fields = new Map<string, string>();
  for (const raw of abc.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('%')) continue;
    const match = FIELD.exec(line);
    if (!match) break; // the first line of music ends the header
    const key = match[1].toUpperCase();
    if (!fields.has(key)) fields.set(key, match[2].trim());
  }
  return fields;
}

export function tempoOf(value: string | undefined): number | null {
  const match = /(\d+(?:\.\d+)?)$/.exec((value ?? '').replace(/"[^"]*"/g, '').trim());
  const bpm = match ? Math.round(Number(match[1])) : NaN;
  return bpm > 0 ? bpm : null;
}

export function keyOf(value: string | undefined): string {
  const tokens = (value ?? '').split(/\s+/).filter((t) => t && !t.includes('='));
  const match = /^([A-Ga-g])([#b]?)(.*)$/.exec(tokens[0] ?? '');
  if (!match) return '';
  const tonic = match[1].toUpperCase() + match[2];
  const mode = (match[3] || tokens[1] || '').toLowerCase();
  if (['m', 'min', 'minor'].includes(mode)) return `${tonic} minor`;
  if (['', 'maj', 'major'].includes(mode)) return `${tonic} major`;
  return MODES.has(mode.slice(0, 3)) ? tokens.slice(0, match[3] ? 1 : 2).join(' ') : '';
}

/** Bars in the `Vocal` voice: every bar line closes one, and a `Z2`..`Z4` multi-bar rest
 * counts as that many. Both voices share one bar grid in YuE2's native two-voice ABC. */
export function barsOf(abc: string): number | null {
  let inVocal = false;
  let bars = 0;
  for (const raw of abc.split(/\r?\n/)) {
    const line = raw.trim();
    const voice = /^V:\s*(\S+)/.exec(line);
    if (voice) { inVocal = voice[1] === 'Vocal'; continue; }
    if (!inVocal || !line || line.startsWith('%') || FIELD.test(line)) continue;
    for (const bar of line.split('|').slice(0, -1)) {
      const rest = /^Z(\d)?$/.exec(bar.trim());
      bars += rest ? Number(rest[1] ?? 1) : 1;
    }
  }
  return bars > 0 ? bars : null;
}

export function abcFacts(abc: string): AbcFacts {
  const fields = header(abc);
  const bpm = tempoOf(fields.get('Q'));
  const meter = (fields.get('M') ?? '').replace(/\s+/g, '');
  const bars = barsOf(abc);
  const fraction = /^(\d+)\/(\d+)$/.exec(meter);
  const quartersPerBar = fraction ? (Number(fraction[1]) * 4) / Number(fraction[2]) : null;
  const seconds = bpm && bars && quartersPerBar ? Math.round((bars * quartersPerBar * 60) / bpm) : null;
  return { bpm, key: keyOf(fields.get('K')), meter, bars, seconds };
}
