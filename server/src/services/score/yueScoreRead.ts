/**
 * yue-server's `POST /v1/scores/read` (F-017, D-047c): the validator's verdict on a stored
 * score plus the planner's facts. It answers 200 with `ok: false` for a score upstream
 * refuses, so only transport and HTTP errors throw.
 */
import { request, failure, headers, type EngineTarget } from '../engineClient.js';
import { yue2Engine } from '../engines/yue2.js';

/** CPU-only parse; generous, but a read must never wait like a render. */
const READ_TIMEOUT_MS = 30_000;

export interface ScoreReadFacts {
  header: { meter: string; unit: string; bpm: number; key: string; bars: number; seconds: number; units_per_quarter: number };
  key_notes: string;
  sections: Array<{ index: number; label: string; from_bar: number; to_bar: number }>;
  lyric_blocks: Array<{ index: number; tag: string; occurrence: number; lines: number; first_line: string }>;
  bar_map: string[];
}

export interface ScoreRead {
  ok: boolean;
  /** Upstream `parse_abc`'s error when `ok` is false. */
  error: string | null;
  /** Per-bar unit-sum messages, e.g. "bar 3 (Ins): 36 of 32 units, too long by 4". */
  messages: string[];
  /** Null when the score did not parse. */
  chordsPresent: boolean | null;
  bpm: number | null;
  seconds: number | null;
  /** Null while yue-server's tokenizer loads. */
  tokens: number | null;
  facts: ScoreReadFacts | null;
}

interface Wire {
  ok?: unknown; error?: unknown; messages?: unknown; chords_present?: unknown;
  bpm?: unknown; seconds?: unknown; tokens?: unknown; facts?: unknown;
}

const num = (v: unknown): number | null => (typeof v === 'number' ? v : null);

export async function readScore(abc: string, lyrics: string | null, target: EngineTarget = yue2Engine): Promise<ScoreRead> {
  const res = await request(target, '/v1/scores/read', {
    method: 'POST',
    headers: headers(target, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ abc, lyrics: lyrics ?? '' }),
  }, 'read score', READ_TIMEOUT_MS);
  if (!res.ok) throw await failure(target, 'read score', res);
  const body = (await res.json()) as Wire;
  return {
    ok: body.ok === true,
    error: typeof body.error === 'string' ? body.error : null,
    messages: Array.isArray(body.messages) ? body.messages.filter((m): m is string => typeof m === 'string') : [],
    chordsPresent: typeof body.chords_present === 'boolean' ? body.chords_present : null,
    bpm: num(body.bpm),
    seconds: num(body.seconds),
    tokens: num(body.tokens),
    facts: body.facts && typeof body.facts === 'object' ? (body.facts as ScoreReadFacts) : null,
  };
}
