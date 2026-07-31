/** Shared HTTP plumbing for the API client slices (see ./index.ts). */

/** Thrown by `json()` for a non-OK response, carrying the HTTP status so callers can tell
 * "this job/lock is gone" (404 — e.g. aborted from the header's status pill, see
 * editorJobStore.ts's startSplit poll) apart from a transient network/server error. */
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError((body as { error?: string }).error ?? `HTTP ${res.status}`, res.status);
  }
  return res.json() as Promise<T>;
}

/** Append params to a multipart form: objects (e.g. the `output` settings block) are
 * JSON-encoded, scalars become strings. Mirrors what the JSON-body paths send and what
 * the server's multipart routes decode (generate.ts pickMultipartParams, songLayers.ts) —
 * a raw String(v) on an object would silently send "[object Object]". */
export function appendParams(form: FormData, params: Record<string, unknown>): void {
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    form.append(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
  }
}
