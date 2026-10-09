/**
 * yue-server's `/v1/splices` (CB-1, D-107, docs/decisions/0005) through engineClient's helpers (bearer auth,
 * timeouts, FastAPI `detail`): submit (multipart: the base version's audio + the spec JSON, `splice-<our job id>`
 * as the Idempotency-Key), status, the spliced float32 WAV, a grid, cancel. A refused submit (422 an op that is not
 * spliced or a span outside the score, 409 a render that is not finished) throws `SpliceRefused`: the caller
 * saves the whole song instead (D-101). A chain (C4) is one job: `steps` in, one verdict out. Shapes: yue-server/splice_spec.py and splice_result.py.
 */
import { errorMessage, failure, headers, request, type EngineTarget } from '../engineClient.js';
import type { Op } from '../score/planTypes.js';
import type { Grid } from './gridCache.js';

/** v1 sends one `op`; v2 (C4, D-263) sends `steps`, last bar first; never both. */
export interface SpliceSpec {
  op?: Op;
  steps?: Array<{ op: Op }>;
  base_abc: string;
  /** Needed when an op (or a step) is a REHARMONIZE: the yue job id of the edited score's render. */
  render_job?: string;
  edited_abc?: string;
  base_grid?: Grid;
}

/** One span's verdict: a v1 result, or one row of a chain's `steps`. */
export interface SpliceStepResult {
  verdict: 'ok' | 'rerender';
  reason: string | null;
  detail: string | null;
  kind: string;
  bars: [number, number];
  audio_seconds: number | null;
  length_diff_s: number | null;
  joins_s: number[];
  crossfade_s: number[];
  snap: Array<{ delta_ms: number; applied: boolean; corr: number | null }>;
  gain_db: unknown;
  null_test: { samples: number; different: number } | null;
}

/** A chain's result (v2): `step` is the 1-based failing step (null when ok), `steps` the rows run so far, `joins_s`
 * the saved file's times; on `rerender` there is no audio. */
export interface SpliceChainResult {
  verdict: 'ok' | 'rerender';
  reason: string | null;
  detail: string | null;
  kind: 'several';
  step: number | null;
  bars: [number, number];
  audio_seconds: number | null;
  length_diff_s: number | null;
  joins_s: number[];
  null_test: { samples: number; different: number } | null;
  steps: SpliceStepResult[];
}

/** The record's `result` once it succeeded: `ok` (audio spliced) or `rerender` (render the whole song). */
export type SpliceResult = SpliceStepResult | SpliceChainResult;
export const isChain = (r: SpliceResult): r is SpliceChainResult => 'steps' in r;

export type SpliceState =
  | { state: 'running'; stage?: string; progress?: number }
  | { state: 'done'; result: SpliceResult }
  | { state: 'failed'; error: string; cancelled?: boolean };

/** yue-server would not take this splice: render the whole song instead. */
export class SpliceRefused extends Error {}

const at = (id: string, rest = '') => `/v1/splices/${encodeURIComponent(id)}${rest}`;

export async function submitSplice(target: EngineTarget, audio: Buffer, filename: string, spec: SpliceSpec, jobId: string): Promise<string> {
  const form = new FormData();
  form.append('spec', JSON.stringify(spec));
  form.append('audio', new Blob([new Uint8Array(audio)]), filename);
  // yue-server keeps one key map for every kind: the same job's render already used `jobId` (409 otherwise).
  const key = `splice-${jobId}`;
  const res = await request(target, '/v1/splices', { method: 'POST', headers: headers(target, { 'Idempotency-Key': key }), body: form }, 'splice');
  if (res.status === 422 || res.status === 409) throw new SpliceRefused((await failure(target, 'splice', res)).message);
  if (!res.ok) throw await failure(target, 'splice', res);
  const job = (await res.json()) as { id?: unknown };
  if (typeof job.id !== 'string' || !job.id) throw new Error(`${target.label} splice -> no job id in reply`);
  return job.id;
}

export async function spliceStatus(target: EngineTarget, id: string): Promise<SpliceState> {
  const res = await request(target, at(id), { headers: headers(target) }, 'splice status');
  if (!res.ok) throw await failure(target, 'splice status', res);
  const job = (await res.json()) as { status?: unknown; stage?: unknown; progress?: unknown; error?: unknown; result?: unknown };
  switch (job.status) {
    case 'queued':
    case 'running':
      return { state: 'running', stage: typeof job.stage === 'string' ? job.stage : undefined, progress: typeof job.progress === 'number' ? job.progress : undefined };
    case 'succeeded': {
      const result = job.result as SpliceResult | null;
      const shaped = result && (result.kind !== 'several' || Array.isArray((result as SpliceChainResult).steps));
      if (!result || !shaped || (result.verdict !== 'ok' && result.verdict !== 'rerender')) return { state: 'failed', error: `${target.label} splice -> no verdict in its result` };
      return { state: 'done', result };
    }
    case 'failed':
      return { state: 'failed', error: errorMessage(job.error) ?? `${target.label} splice failed` };
    case 'cancelled':
      return { state: 'failed', error: `${target.label} cancelled the splice`, cancelled: true };
    default:
      return { state: 'failed', error: `${target.label} splice status -> unknown status ${JSON.stringify(job.status)}` };
  }
}

export async function fetchSpliceAudio(target: EngineTarget, id: string): Promise<Buffer> {
  const res = await request(target, at(id, '/audio'), { headers: headers(target) }, 'splice audio');
  if (!res.ok) throw await failure(target, 'splice audio', res);
  return Buffer.from(await res.arrayBuffer());
}

/** A grid the splice fitted (base, render or the output's), or null when yue-server has none. */
export async function fetchSpliceGrid(target: EngineTarget, id: string, which: 'base' | 'render' | 'out'): Promise<unknown> {
  try {
    const res = await request(target, at(id, `/grid/${which}`), { headers: headers(target) }, 'splice grid');
    return res.ok ? await res.json() : null;
  } catch {
    return null; // a grid is a cache: missing it costs one more tracking run next time, nothing else
  }
}

/** Fire-and-forget, as the transcription cancel: our side is done with the job either way. */
export async function cancelSplice(target: EngineTarget, id: string): Promise<void> {
  try {
    await request(target, at(id, '/cancel'), { method: 'POST', headers: headers(target) }, 'splice cancel');
  } catch {
    // unreachable yue-server: its retention sweep removes the files
  }
}
