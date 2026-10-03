/**
 * The Ollama-only planner calls (D-012; SP-1): probe, list loaded models (`/api/ps`), unload
 * (`POST /api/generate {keep_alive: 0}`, not accepted on `/v1`) and wait until `/api/ps` is
 * empty — the GPU hand-off a `plan` job holds its queue slot through (D-011, F-020 #1, #4, #5).
 */

export interface PlannerTarget { url: string; model: string }

export interface LoadedModel { name: string; contextLength: number | null }

/** Poll interval and bound for the unload (F-020 #1, #4). */
export const UNLOAD_POLL_MS = 250;
export const UNLOAD_BOUND_MS = 10_000;
const CONTROL_TIMEOUT_MS = 5_000;

async function call(t: PlannerTarget, route: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(`${t.url}${route}`, { ...init, signal: AbortSignal.timeout(CONTROL_TIMEOUT_MS) });
  } catch (err) {
    throw new Error(`planner offline: no answer from ${t.url} (${err instanceof Error ? err.message : String(err)})`);
  }
}

export const notOllama = (url: string) =>
  `LLM_API_URL ${url} is not an Ollama server (no /api/ps), so the planner cannot be unloaded before a render: unsupported`;

/** Null when the planner can be used; else why not (offline, not Ollama, model not pulled). */
export async function probePlanner(t: PlannerTarget): Promise<string | null> {
  try {
    const ps = await call(t, '/api/ps');
    if (ps.status === 404) return notOllama(t.url);
    if (!ps.ok) return `planner ${t.url}/api/ps -> HTTP ${ps.status}`;
    const tags = await call(t, '/api/tags');
    if (!tags.ok) return `planner ${t.url}/api/tags -> HTTP ${tags.status}`;
    const { models } = (await tags.json()) as { models?: Array<{ name?: string; model?: string }> };
    const names = (models ?? []).flatMap((m) => [m.name, m.model]);
    return names.includes(t.model) ? null : `model ${t.model} is not on the planner: run 'ollama pull ${t.model}'`;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
}

/** What `/api/ps` lists now. Throws when the server is gone or is not Ollama. */
export async function loadedModels(t: PlannerTarget): Promise<LoadedModel[]> {
  const res = await call(t, '/api/ps');
  if (res.status === 404) throw new Error(notOllama(t.url));
  if (!res.ok) throw new Error(`planner ${t.url}/api/ps -> HTTP ${res.status}`);
  const { models } = (await res.json()) as { models?: Array<{ name?: string; model?: string; context_length?: number }> };
  return (models ?? []).map((m) => ({
    name: m.name ?? m.model ?? '?', contextLength: typeof m.context_length === 'number' ? m.context_length : null,
  }));
}

/** Asks Ollama to drop the model now. It answers before the memory is free: see waitUnloaded. */
export async function unloadPlanner(t: PlannerTarget): Promise<void> {
  const res = await call(t, '/api/generate', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: t.model, keep_alive: 0 }),
  });
  if (!res.ok) throw new Error(`planner unload -> HTTP ${res.status}`);
}

export const stillLoaded = (names: string[], boundMs: number) => {
  const list = names.join(', ');
  return `the planner model ${list} is still loaded after ${Math.round(boundMs / 1000)} s: run 'ollama stop ${names[0]}'`
    + ' and wait for it to leave the GPU before rendering';
};

export interface WaitOptions {
  intervalMs?: number;
  boundMs?: number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

/** Polls `/api/ps` until no model is listed; throws naming the model after the bound. */
export async function waitUnloaded(t: PlannerTarget, o: WaitOptions = {}): Promise<{ polls: number; ms: number }> {
  const interval = o.intervalMs ?? UNLOAD_POLL_MS;
  const bound = o.boundMs ?? UNLOAD_BOUND_MS;
  const sleep = o.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const now = o.now ?? Date.now;
  const started = now();
  for (let polls = 1; ; polls++) {
    const models = await loadedModels(t);
    if (models.length === 0) return { polls, ms: now() - started };
    if (now() - started >= bound) throw new Error(stillLoaded(models.map((m) => m.name), bound));
    await sleep(interval);
  }
}

/** The hand-off: unload, then confirm. The unload call failing does not skip the confirmation. */
export async function releasePlanner(t: PlannerTarget, o: WaitOptions = {}): Promise<{ polls: number; ms: number }> {
  await unloadPlanner(t).catch(() => undefined);
  return waitUnloaded(t, o);
}
