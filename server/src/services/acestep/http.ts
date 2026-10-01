/** Shared HTTP plumbing for the ACE-Step client slices (see ../acestep.ts). */
import { config } from '../../config.js';

interface Envelope<T> {
  data: T;
  code: number;
  error: string | null;
}

/** fetch with a hard deadline, converting the DOMException-flavored abort into a
 * plain Error that names the endpoint — poll()/callers surface `error` as-is. */
export async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number, label: string): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch (err) {
    if (err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
      throw new Error(`ACE-Step ${label} -> no response within ${Math.round(timeoutMs / 1000)}s`);
    }
    throw err;
  }
}

export async function call<T>(endpoint: string, body?: unknown, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {};
  if (config.acestepApiKey) headers['Authorization'] = `Bearer ${config.acestepApiKey}`;
  let opts: RequestInit;
  if (init) {
    opts = { ...init, headers: { ...headers, ...(init.headers as Record<string, string>) } };
  } else {
    opts = body
      ? { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
      : { headers };
  }
  const res = await fetchWithTimeout(`${config.acestepUrl}${endpoint}`, opts, config.acestepTimeoutMs, endpoint);
  if (!res.ok) {
    // Most ACE-Step failures come back as HTTP 200 with a {data,code,error} envelope (handled
    // below), but some routes (e.g. analyze_audio's "DiT/LLM not initialized") raise a real
    // FastAPI HTTPException — a genuine non-2xx status with a bare {"detail": "..."} body, no
    // envelope at all. Surface that detail instead of a bare "HTTP 503".
    const errBody = await res.json().catch(() => null) as { error?: string; detail?: string } | null;
    throw new Error(`ACE-Step ${endpoint} -> ${errBody?.error ?? errBody?.detail ?? `HTTP ${res.status}`}`);
  }
  const json = (await res.json()) as Envelope<T>;
  if (json.code !== 200) throw new Error(`ACE-Step ${endpoint} -> ${json.error ?? `code ${json.code}`}`);
  return json.data;
}
