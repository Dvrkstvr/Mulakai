/**
 * yue-server's `/v1/transcriptions` routes (PLAN.md "YuE2 Melody Covers via SheetSage2",
 * point 7): SheetSage2 reads a source song's melody into a score for a YuE2 cover. Same
 * bearer auth and Idempotency-Key convention as engineClient.ts, whose helpers it reuses.
 */
import { errorMessage, failure, headers, request, type EngineTarget } from './engineClient.js';

const HEALTH_TIMEOUT_MS = 10_000;

/** Where one of the score's `% label` sections starts in the source, from its downbeats
 * (PLAN.md "Section start times with a transcription"). `bar` is 0-based. */
export interface SectionStart {
  label: string;
  bar: number;
  seconds: number;
}

/** What yue-server reports once a transcription has succeeded (its record's `result`). */
export interface TranscriptionFacts {
  warnings: string[];
  measures: number | null;
  vocalNotes: number | null;
  instrumentalNotes: number | null;
  durationSeconds: number | null;
  hasPreview: boolean;
  /** Null when yue-server sent none: an older yue-server, or no downbeats to anchor to. */
  sectionStarts: SectionStart[] | null;
}

export interface TranscriptionState {
  state: 'running' | 'done' | 'failed';
  progress?: number;
  stage?: string;
  error?: string;
  facts?: TranscriptionFacts;
}

const path = (id: string, rest = '') => `/v1/transcriptions/${encodeURIComponent(id)}${rest}`;
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** 200 from the unauthenticated health route. A `yue2-serve` backend has no such route. */
export async function transcriptionHealth(target: EngineTarget): Promise<boolean> {
  if (!target.url) return false;
  try {
    const res = await fetch(`${target.url}/v1/transcriptions/health`, { signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS) });
    return res.ok;
  } catch {
    return false;
  }
}

/** Returns yue-server's transcription id. Our job id rides along as the Idempotency-Key. */
export async function transcribe(target: EngineTarget, audio: Buffer, filename: string, jobId: string): Promise<string> {
  const form = new FormData();
  form.append('audio', new Blob([new Uint8Array(audio)]), filename);
  const res = await request(target, '/v1/transcriptions', {
    method: 'POST', headers: headers(target, { 'Idempotency-Key': jobId }), body: form,
  }, 'transcribe');
  if (!res.ok) throw await failure(target, 'transcribe', res);
  const job = (await res.json()) as { id?: unknown };
  if (typeof job.id !== 'string' || !job.id) throw new Error(`${target.label} transcribe -> no job id in reply`);
  return job.id;
}

function readSectionStarts(raw: unknown): SectionStart[] | null {
  if (!Array.isArray(raw)) return null;
  return raw.flatMap((entry) => {
    const s = (entry ?? {}) as Record<string, unknown>;
    const bar = num(s.bar);
    const seconds = num(s.seconds);
    return typeof s.label === 'string' && bar !== null && seconds !== null ? [{ label: s.label, bar, seconds }] : [];
  });
}

function readFacts(result: unknown): TranscriptionFacts {
  const r = (result ?? {}) as Record<string, unknown>;
  return {
    warnings: Array.isArray(r.warnings) ? r.warnings.map(String) : [],
    measures: num(r.measures),
    vocalNotes: num(r.vocal_notes),
    instrumentalNotes: num(r.instrumental_notes),
    durationSeconds: num(r.duration_seconds),
    hasPreview: typeof r.preview_url === 'string',
    sectionStarts: readSectionStarts(r.section_starts),
  };
}

export async function transcriptionStatus(target: EngineTarget, id: string): Promise<TranscriptionState> {
  const res = await request(target, path(id), { headers: headers(target) }, 'transcription status');
  if (!res.ok) throw await failure(target, 'transcription status', res);
  const job = (await res.json()) as { status?: unknown; stage?: unknown; progress?: unknown; error?: unknown; result?: unknown };
  const stage = typeof job.stage === 'string' ? job.stage : undefined;
  switch (job.status) {
    case 'queued':
    case 'running':
      return { state: 'running', stage, progress: num(job.progress) ?? undefined };
    case 'succeeded':
      return { state: 'done', stage, facts: readFacts(job.result) };
    case 'failed':
      return { state: 'failed', error: errorMessage(job.error) ?? `${target.label} transcription failed` };
    case 'cancelled':
      return { state: 'failed', error: `${target.label} cancelled the transcription` };
    default:
      return { state: 'failed', error: `${target.label} transcription status -> unknown status ${JSON.stringify(job.status)}` };
  }
}

export async function fetchTranscriptionScore(target: EngineTarget, id: string): Promise<string> {
  const res = await request(target, path(id, '/score'), { headers: headers(target) }, 'score download');
  if (!res.ok) throw await failure(target, 'score download', res);
  return res.text();
}

/** The raw preview response, for the route to stream on. `range` is forwarded so the player
 * can seek; the caller relays status (200/206/404) and headers as they come. Deliberately not
 * `request()`: its timeout would cut the body off mid-stream while a paused player holds the
 * connection. The caller owns `signal` and times only the headers. */
export async function fetchTranscriptionPreview(
  target: EngineTarget, id: string, range: string | undefined, signal: AbortSignal,
): Promise<Response> {
  try {
    return await fetch(`${target.url}${path(id, '/preview')}`, { headers: headers(target, range ? { Range: range } : {}), signal });
  } catch (err) {
    throw new Error(`${target.label} preview -> ${err instanceof Error ? err.message : String(err)}`);
  }
}

/** Fire-and-forget, as engineClient's cancel: our side has already given up on the job. */
export async function cancelTranscription(target: EngineTarget, id: string): Promise<void> {
  try {
    await request(target, path(id, '/cancel'), { method: 'POST', headers: headers(target) }, 'cancel');
  } catch {
    // unreachable wrapper: nothing more to do
  }
}
