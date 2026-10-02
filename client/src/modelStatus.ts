/** The header's model status badge, as data: one row per model or service the app talks to,
 * plus the one-line summary the badge shows. Pure, so the rules live in tests, not in JSX. */
import type { EngineId, EngineInfo, SplitHealth } from './api';

export type AcestepState = 'online' | 'busy' | 'offline';

/** ready/busy = usable, down = set up but not answering, off = not set up here,
 * checking = no answer yet. Only `down` counts against the summary. */
export type RowState = 'ready' | 'busy' | 'down' | 'off' | 'checking';

export interface StatusRow {
  id: string;
  name: string;
  /** What the app uses it for. */
  role: string;
  state: RowState;
  text: string;
}

export interface StatusInput {
  acestep: AcestepState | null;
  /** null = not loaded yet; [] = this server offers no extra engines. */
  engines: EngineInfo[] | null;
  split: SplitHealth | null;
  lyrics: { configured: boolean; ready: boolean } | null;
}

/** An engine's cover transcriber, where it has one (EnginesSection says what it needs). */
const COVER_MODEL: Partial<Record<EngineId, string>> = { yue2: 'SHEETSAGE2' };

const checking = (id: string, name: string, role: string): StatusRow =>
  ({ id, name, role, state: 'checking', text: '…' });

function service(id: string, name: string, role: string, configured: boolean, ready: boolean): StatusRow {
  if (!configured) return { id, name, role, state: 'off', text: 'NOT CONFIGURED' };
  return ready ? { id, name, role, state: 'ready', text: 'READY' } : { id, name, role, state: 'down', text: 'UNREACHABLE' };
}

function acestepRow(state: AcestepState | null): StatusRow {
  const row = { id: 'acestep', name: 'ACE-STEP 1.5', role: 'create · repaint · layers · remaster' };
  if (state === 'online') return { ...row, state: 'ready', text: 'ONLINE' };
  if (state === 'busy') return { ...row, state: 'busy', text: 'BUSY' };
  if (state === 'offline') return { ...row, state: 'down', text: 'OFFLINE' };
  return checking(row.id, row.name, row.role);
}

function engineRows(engines: EngineInfo[] | null): StatusRow[] {
  if (!engines) return [checking('engines', 'EXTRA ENGINES', 'first take only')];
  return engines.filter((e) => e.id !== 'acestep').flatMap((e) => {
    const rows = [service(e.id, e.label, 'first take only', e.configured, e.ready)];
    const cover = COVER_MODEL[e.id];
    // Only once the engine answers: a down engine also reports coverReady false.
    if (cover && e.ready) {
      rows.push(e.coverReady
        ? { id: `${e.id}-cover`, name: cover, role: `${e.label} covers`, state: 'ready', text: 'READY' }
        : { id: `${e.id}-cover`, name: cover, role: `${e.label} covers`, state: 'off', text: 'NOT SET UP' });
    }
    return rows;
  });
}

function splitRows(split: SplitHealth | null): StatusRow[] {
  if (!split) return [checking('split', 'STEM SPLIT', 'split')];
  const name = split.demucsBackend ? split.demucsBackend.toUpperCase() : 'DEMUCS / UVR';
  const rows = [service('demucs', name, 'stem split', split.demucsReason !== 'unset', split.demucs)];
  // When ACE-Step itself didn't answer, its own row already says so.
  if (split.acestepError === null) {
    rows.push(split.acestep
      ? { id: 'extract', name: 'ACE-STEP EXTRACT', role: 'stem split', state: 'ready', text: 'READY' }
      : { id: 'extract', name: 'ACE-STEP EXTRACT', role: 'stem split', state: 'off', text: 'NO EXTRACT MODEL' });
  }
  return rows;
}

export function statusRows({ acestep, engines, split, lyrics }: StatusInput): StatusRow[] {
  return [
    acestepRow(acestep),
    ...engineRows(engines),
    ...splitRows(split),
    lyrics
      ? service('lyrics', 'LYRICS READER', 'read lyrics · word timings', lyrics.configured, lyrics.ready)
      : checking('lyrics', 'LYRICS READER', 'read lyrics · word timings'),
  ];
}

export interface StatusSummary {
  text: string;
  tone: 'ok' | 'busy' | 'down' | 'checking';
}

/** ACE-Step runs every edit, so it being down outranks a count of the rest. */
export function statusSummary(acestep: AcestepState | null, rows: StatusRow[]): StatusSummary {
  if (acestep === 'offline') return { text: 'ACE-STEP OFFLINE', tone: 'down' };
  const down = rows.filter((r) => r.state === 'down').length;
  if (down) return { text: `${down} DOWN`, tone: 'down' };
  if (acestep === null) return { text: 'CHECKING…', tone: 'checking' };
  if (acestep === 'busy') return { text: 'ACE-STEP BUSY', tone: 'busy' };
  const live = rows.filter((r) => r.state === 'ready').length;
  return { text: `${live} READY`, tone: 'ok' };
}
