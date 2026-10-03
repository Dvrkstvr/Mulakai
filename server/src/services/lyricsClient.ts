/**
 * lyrics-server (PLAN.md "lyrics-server contract"): reads the words sung in a song into
 * timed segments. One synchronous call per job; Mulakai's job queue keeps it single-flight.
 */
import { config } from '../config.js';

const HEALTH_TIMEOUT_MS = 5_000;

export interface LyricWord {
  text: string;
  start: number;
  end: number;
}

export interface LyricSegment extends LyricWord {
  words: LyricWord[];
}

export interface LyricsReading {
  language: string;
  segments: LyricSegment[];
}

/** 200 from GET /health, which loads nothing on the service. */
export async function lyricsHealth(url = config.lyricsUrl): Promise<boolean> {
  if (!url) return false;
  try {
    const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS) });
    return res.ok;
  } catch {
    return false;
  }
}

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : NaN);

function readWord(raw: unknown): LyricWord | null {
  const w = (raw ?? {}) as Record<string, unknown>;
  const word = { text: typeof w.text === 'string' ? w.text : '', start: num(w.start), end: num(w.end) };
  return word.text && Number.isFinite(word.start) && Number.isFinite(word.end) ? word : null;
}

/** Keeps only well-formed segments; a malformed reply as a whole is an error. */
function readReading(body: unknown): LyricsReading {
  const b = (body ?? {}) as Record<string, unknown>;
  if (typeof b.language !== 'string' || !Array.isArray(b.segments)) {
    throw new Error('lyrics-server transcribe -> unexpected reply');
  }
  const segments: LyricSegment[] = [];
  for (const raw of b.segments) {
    const seg = readWord(raw);
    if (!seg) continue;
    const words = (raw as { words?: unknown }).words;
    segments.push({ ...seg, words: Array.isArray(words) ? words.map(readWord).filter((w): w is LyricWord => !!w) : [] });
  }
  return { language: b.language, segments };
}

/** `language` empty = auto-detect. `signal` lets an aborted job stop waiting. */
export async function transcribeLyrics(
  audio: Buffer, filename: string, language: string, signal?: AbortSignal,
): Promise<LyricsReading> {
  if (!config.lyricsUrl) throw new Error('READ LYRICS is not set up (LYRICS_API_URL unset)');
  const form = new FormData();
  form.append('audio', new Blob([new Uint8Array(audio)]), filename);
  form.append('language', language);
  const timeout = AbortSignal.timeout(config.lyricsTimeoutMs);
  let res: Response;
  try {
    res = await fetch(`${config.lyricsUrl}/transcribe`, {
      method: 'POST', body: form, signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
  } catch (err) {
    throw new Error(`lyrics-server transcribe -> ${err instanceof Error ? err.message : String(err)}`);
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { detail?: unknown } | null;
    const detail = typeof body?.detail === 'string' ? body.detail : `HTTP ${res.status}`;
    throw new Error(`lyrics-server transcribe -> ${detail}`);
  }
  return readReading(await res.json());
}
