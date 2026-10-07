/**
 * CP-C0a-ONLY (pipeline checkpoint, scope.md CA-4; not app code, never imported by src/): the pure
 * part of chatCp0.ts. Per-turn records -> summary numbers -> the scope's stop lines -> summary.md.
 * Stop lines (scope.md CA-4): turn p50 > 15 s, a hand-off > 5 s, a recipe still invalid after 3
 * attempts more than once. A hand-off is either a turn's last planner call -> `/api/ps` empty, or
 * CREATE SONG pressed -> the take running; the worst one counts.
 */

export interface CreateResult {
  postStatus: number;
  outcome: 'saved' | 'failed' | 'refused' | 'timeout';
  reason?: string;
  jobId?: string;
  /** CREATE SONG pressed -> the take's job reported running. */
  handoffMs: number | null;
  /** CREATE SONG pressed -> the take saved (or failed). */
  takeMs: number | null;
  songId: string | null;
  seconds: number | null;
  plannerLoadedAtPress?: boolean | null;
}

export interface TurnResult {
  index: number;
  id: string;
  lang: string;
  /** The reply kind the prompt should get (the edit leg expects `edit`). */
  expect: 'recipe' | 'ask' | 'edit';
  prompt: string;
  postStatus: number;
  /** The reply's message kind (recipe / ask / say / failed / edit), or null when none came. */
  action: string | null;
  cause: string | null;
  reasons: string[];
  /** Highest "attempt n of 3" the job showed, or the planner calls seen by the proxy. */
  attempts: number | null;
  calls: number | null;
  turnMs: number | null;
  queuedMs: number | null;
  promptTokens: Array<number | null>;
  /** The turn's last planner call answered -> the first empty `/api/ps` after the unload ack (proxy). */
  unloadMs: number | null;
  vram: { beforeMiB: number | null; peakMiB: number | null; atEmptyMiB: number | null } | null;
  create?: CreateResult;
}

export interface Summary {
  turns: number;
  byAction: Record<string, number>;
  turnP50S: number | null;
  turnP95S: number | null;
  coldS: number | null;
  warmP50S: number | null;
  attemptsMax: number | null;
  invalidAfter3: number;
  expectMisses: string[];
  unloadMaxMs: number | null;
  createHandoffMs: number[];
  takeS: number[];
}

/** The proxy's events (scoreCp1Lib.startOllamaProxy) shape, kept here so this module stays pure. */
export interface PlannerEvent { t0: number; t1: number; method: string; path: string; info: Record<string, unknown> }

/** One turn's window [from, to] in the proxy log: planner calls, their prompt tokens, and unload-to-empty
 * (last call answered -> first empty `/api/ps` after the `keep_alive: 0` ack). */
export function plannerWindow(events: PlannerEvent[], from: number, to: number) {
  const inside = events.filter((e) => e.t0 >= from - 50 && e.t1 <= to + 50);
  const chats = inside.filter((e) => e.path.startsWith('/v1/chat'));
  const usage = (e: PlannerEvent) => (e.info.usage as { prompt_tokens?: number } | undefined)?.prompt_tokens ?? null;
  const last = chats.at(-1);
  const ack = last ? inside.find((e) => e.method === 'POST' && e.path.startsWith('/api/generate') && e.t0 >= last.t1) : undefined;
  const empty = ack ? inside.find((e) => e.path.startsWith('/api/ps') && e.t0 >= ack.t1 && Array.isArray(e.info.models) && e.info.models.length === 0) : undefined;
  return { calls: chats.length, promptTokens: chats.map(usage), unloadMs: last && empty ? empty.t1 - last.t1 : null };
}

export type Verdict = 'PASS' | 'STOP' | 'NO DATA';
export interface StopLine { verdict: Verdict; text: string }

/** Nearest-rank percentile; null for no values. */
export function percentile(values: number[], p: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)];
}

const nums = (xs: Array<number | null | undefined>) => xs.filter((x): x is number => typeof x === 'number' && Number.isFinite(x));
const s1 = (ms: number | null) => (ms === null ? null : Math.round(ms / 100) / 10);
const max = (xs: number[]) => (xs.length ? Math.max(...xs) : null);

export function summarize(results: TurnResult[]): Summary {
  const byAction: Record<string, number> = {};
  for (const r of results) byAction[r.action ?? 'none'] = (byAction[r.action ?? 'none'] ?? 0) + 1;
  const times = nums(results.map((r) => r.turnMs));
  const first = results[0]?.turnMs ?? null;
  return {
    turns: results.length,
    byAction,
    turnP50S: s1(percentile(times, 50)),
    turnP95S: s1(percentile(times, 95)),
    coldS: s1(first),
    warmP50S: s1(percentile(nums(results.slice(1).map((r) => r.turnMs)), 50)),
    attemptsMax: max(nums(results.map((r) => r.attempts ?? r.calls))),
    // A turn that ran out of attempts fails with cause `check` (turnJob.ts); offline / cancel / context are other causes.
    invalidAfter3: results.filter((r) => r.action === 'failed' && r.cause === 'check').length,
    expectMisses: results.filter((r) => r.action !== r.expect).map((r) => r.id),
    unloadMaxMs: max(nums(results.map((r) => r.unloadMs))),
    createHandoffMs: nums(results.map((r) => r.create?.handoffMs)),
    takeS: nums(results.map((r) => r.create?.takeMs)).map((ms) => Math.round(ms / 1000)),
  };
}

export function stopLines(s: Summary): StopLine[] {
  const fmt = (x: number | null) => (x === null ? 'n/a' : `${x.toFixed(1)} s`);
  const handoff = max(nums([s.unloadMaxMs, ...s.createHandoffMs]));
  const handoffS = handoff === null ? null : handoff / 1000;
  return [
    {
      verdict: s.turnP50S === null ? 'NO DATA' : s.turnP50S > 15 ? 'STOP' : 'PASS',
      text: `turn p50 ${fmt(s.turnP50S)} (stop over 15 s)`,
    },
    {
      verdict: handoffS === null ? 'NO DATA' : handoffS > 5 ? 'STOP' : 'PASS',
      text: `worst hand-off ${fmt(handoffS)}: unload-to-empty max ${fmt(s.unloadMaxMs === null ? null : s.unloadMaxMs / 1000)}, CREATE-to-running max ${fmt(s.createHandoffMs.length ? Math.max(...s.createHandoffMs) / 1000 : null)} (stop over 5 s)`,
    },
    {
      verdict: s.invalidAfter3 > 1 ? 'STOP' : 'PASS',
      text: `invalid after 3 attempts: ${s.invalidAfter3} (stop when more than 1)`,
    },
  ];
}

export function summaryMarkdown(s: Summary, results: TurnResult[], meta: { server: string; date: string; note?: string }): string {
  const cell = (x: unknown) => (x === null || x === undefined ? '-' : String(x).replace(/\|/g, '/'));
  const rows = results.map((r) => `| ${[r.index + 1, r.id, r.lang, r.expect, r.action, r.cause, r.attempts ?? r.calls, s1(r.turnMs),
    r.promptTokens.filter((t) => t !== null).join(' / ') || null, r.unloadMs,
    r.create ? `${r.create.outcome}, hand-off ${r.create.handoffMs ?? '-'} ms, take ${s1(r.create.takeMs) ?? '-'} s` : null,
  ].map(cell).join(' | ')} |`);
  return [
    `# CP-C0a, create leg (${meta.date})`, '',
    `Server ${meta.server}. ${meta.note ?? ''}`.trim(), '',
    '## Stop lines', '',
    ...stopLines(s).map((l) => `- ${l.verdict} ${l.text}`), '',
    '## Numbers', '',
    `- turns ${s.turns}; actions ${Object.entries(s.byAction).map(([k, v]) => `${k} ${v}`).join(', ')}`,
    `- turn p50 ${s.turnP50S ?? '-'} s, p95 ${s.turnP95S ?? '-'} s; cold (first) ${s.coldS ?? '-'} s, warm p50 ${s.warmP50S ?? '-'} s`,
    `- attempts max ${s.attemptsMax ?? '-'}; invalid after 3: ${s.invalidAfter3}; not the expected action: ${s.expectMisses.join(', ') || 'none'}`,
    `- unload-to-empty max ${s.unloadMaxMs ?? '-'} ms; CREATE-to-running ${s.createHandoffMs.join(', ') || '-'} ms; takes saved in ${s.takeS.join(', ') || '-'} s`, '',
    '## Turns', '',
    '| # | id | lang | expect | action | cause | attempts | turn s | prompt tokens | unload ms | CREATE SONG |',
    '|---|---|---|---|---|---|---|---|---|---|---|',
    ...rows, '',
  ].join('\n');
}
