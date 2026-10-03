/**
 * One HTTP client for every extra engine's wrapper — they all speak the job API of
 * YuE2-Turbo's `yue2-serve` (PLAN.md design point 3 and its "Contract details").
 */
import { config } from '../config.js';
import type { SongEngine } from './engines/types.js';

/** Just what a call needs from an engine: where it is and what to call it in errors. */
export type EngineTarget = Pick<SongEngine, 'label' | 'url' | 'apiKey'>;

/** A wrapper's job status, normalised onto Mulakai's own job lifecycle. */
export interface EngineJobState {
  state: 'running' | 'done' | 'failed';
  /** `truncated` on the wire: the plan outran the engine's token budget, but audio exists. */
  truncated: boolean;
  /** 0-1, when the wrapper reports one. */
  progress?: number;
  stage?: string;
  error?: string;
}

const HEALTH_TIMEOUT_MS = 10_000;

export function headers(target: EngineTarget, extra?: Record<string, string>): Record<string, string> {
  return { ...(target.apiKey ? { Authorization: `Bearer ${target.apiKey}` } : {}), ...extra };
}

export async function request(target: EngineTarget, route: string, init: RequestInit, label: string, timeoutMs = config.acestepTimeoutMs): Promise<Response> {
  try {
    return await fetch(`${target.url}${route}`, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch (err) {
    if (err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
      throw new Error(`${target.label} ${label} -> no response within ${Math.round(timeoutMs / 1000)}s`);
    }
    throw new Error(`${target.label} ${label} -> ${err instanceof Error ? err.message : String(err)}`);
  }
}

/** FastAPI's `detail` is a string, or a list of validation errors for a 422. */
export async function failure(target: EngineTarget, label: string, res: Response): Promise<Error> {
  let detail = '';
  try {
    const body = (await res.json()) as { detail?: unknown };
    if (typeof body.detail === 'string') detail = body.detail;
    else if (Array.isArray(body.detail)) detail = String((body.detail[0] as { msg?: unknown })?.msg ?? '');
  } catch {
    // not JSON — the status code alone will have to do
  }
  return new Error(`${target.label} ${label} -> HTTP ${res.status}${detail ? `: ${detail}` : ''}`);
}

export async function health(target: EngineTarget): Promise<boolean> {
  if (!target.url) return false;
  try {
    const res = await fetch(`${target.url}/health/ready`, { headers: headers(target), signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS) });
    return res.ok;
  } catch {
    return false;
  }
}

/** Returns the wrapper's own job id. Our job id rides along as the Idempotency-Key, so
 * both sides' logs line up and a retried submit can't start a second song. */
export async function submit(target: EngineTarget, body: Record<string, unknown>, jobId: string): Promise<string> {
  const res = await request(target, '/v1/jobs', {
    method: 'POST',
    headers: headers(target, { 'Content-Type': 'application/json', 'Idempotency-Key': jobId }),
    body: JSON.stringify(body),
  }, 'submit');
  if (!res.ok) throw await failure(target, 'submit', res);
  const job = (await res.json()) as { id?: unknown };
  if (typeof job.id !== 'string' || !job.id) throw new Error(`${target.label} submit -> no job id in reply`);
  return job.id;
}

export function errorMessage(error: unknown): string | undefined {
  if (typeof error === 'string') return error || undefined;
  if (error && typeof error === 'object' && typeof (error as { message?: unknown }).message === 'string') {
    return (error as { message: string }).message || undefined;
  }
  return undefined;
}

export async function status(target: EngineTarget, id: string): Promise<EngineJobState> {
  const res = await request(target, `/v1/jobs/${encodeURIComponent(id)}`, { headers: headers(target) }, 'status');
  if (!res.ok) throw await failure(target, 'status', res);
  const job = (await res.json()) as { status?: unknown; stage?: unknown; progress?: unknown; error?: unknown };
  const stage = typeof job.stage === 'string' ? job.stage : undefined;
  const progress = typeof job.progress === 'number' && Number.isFinite(job.progress) ? job.progress : undefined;
  switch (job.status) {
    case 'queued':
    case 'running':
      return { state: 'running', truncated: false, progress, stage };
    case 'succeeded':
      return { state: 'done', truncated: false, stage };
    case 'truncated':
      return { state: 'done', truncated: true, stage };
    case 'failed':
      return { state: 'failed', truncated: false, error: errorMessage(job.error) ?? `${target.label} generation failed` };
    case 'cancelled':
      return { state: 'failed', truncated: false, error: `${target.label} cancelled the job` };
    default:
      // Anything outside the contract fails rather than polls forever holding the queue's slot.
      return { state: 'failed', truncated: false, error: `${target.label} status -> unknown status ${JSON.stringify(job.status)}` };
  }
}

export async function fetchAudio(target: EngineTarget, id: string): Promise<Buffer> {
  // 5x the control-call budget, same as acestep.ts's downloadAudio: masters are large.
  const res = await request(target, `/v1/jobs/${encodeURIComponent(id)}/audio`, { headers: headers(target) }, 'audio download', config.acestepTimeoutMs * 5);
  if (!res.ok) throw await failure(target, 'audio download', res);
  return Buffer.from(await res.arrayBuffer());
}

/** Null when the engine has no score (404); any other failure throws. */
export async function fetchScore(target: EngineTarget, id: string): Promise<string | null> {
  const res = await request(target, `/v1/jobs/${encodeURIComponent(id)}/score`, { headers: headers(target) }, 'score download');
  if (res.status === 404) return null;
  if (!res.ok) throw await failure(target, 'score download', res);
  return res.text();
}

/** Fire-and-forget: the job is already abandoned on our side, whatever the wrapper says. */
export async function cancel(target: EngineTarget, id: string): Promise<void> {
  try {
    await request(target, `/v1/jobs/${encodeURIComponent(id)}/cancel`, { method: 'POST', headers: headers(target) }, 'cancel');
  } catch {
    // unreachable wrapper: nothing more to do
  }
}
