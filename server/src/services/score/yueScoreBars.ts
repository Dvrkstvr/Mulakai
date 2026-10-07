/**
 * yue-server's `POST /v1/scores/bars` (chat C1, D-174): a score's bar start times on a take's downbeat grid, by
 * the splice's own fit, so the chat's strip and a splice cannot disagree (ABC stays on yue-server, decisions/0002).
 * A refusal (422 `bad_grid` / `bad_score`, dict detail `{code, message}`) or an unreadable reply is a reason, never
 * a guess; only transport errors throw. The check stays strict: yue-server guarantees strictly increasing starts
 * that end before `end` (Q-120, score_bar_times.py), so a reply that breaks it is a bug, not a song.
 */
import { errorMessage, headers, request, type EngineTarget } from '../engineClient.js';
import type { BarTimes } from '../chat/analysisTypes.js';

/** CPU only, as /v1/scores/read. */
const BARS_TIMEOUT_MS = 30_000;

export type BarsResult = { ok: true; bars: BarTimes } | { ok: false; reason: string };

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** `source`: where the grid came from (the cache, this analysis's tracking, a splice's mapping). */
export async function scoreBars(target: EngineTarget, abc: string, grid: unknown, source: BarTimes['source']): Promise<BarsResult> {
  const res = await request(target, '/v1/scores/bars', {
    method: 'POST', headers: headers(target, { 'Content-Type': 'application/json' }), body: JSON.stringify({ abc, grid }),
  }, 'bar times', BARS_TIMEOUT_MS);
  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok) {
    const why = errorMessage((body as { detail?: unknown } | null)?.detail);
    return { ok: false, reason: `${target.label} could not time the bars: ${why ?? `HTTP ${res.status}`}` };
  }
  const starts = body?.starts;
  if (!body || !isNum(body.offset) || !isNum(body.end) || !Array.isArray(starts) || !starts.length || !starts.every(isNum)
    || !(body.agreement === null || isNum(body.agreement)) || starts.some((t, i) => i > 0 && t <= starts[i - 1]) || body.end < starts[starts.length - 1]) {
    return { ok: false, reason: `${target.label} bar times -> unreadable reply` };
  }
  return { ok: true, bars: { source, offset: body.offset, starts, end: body.end, agreement: body.agreement as number | null } };
}
