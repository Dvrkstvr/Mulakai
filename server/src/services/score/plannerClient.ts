/**
 * One planner call (F-019 #1, D-002, D-012): `POST {LLM_API_URL}/v1/chat/completions` with a
 * strict JSON-schema `response_format` built per song and `reasoning_effort: "none"` (a thinking
 * model otherwise spends the whole budget reasoning and returns empty content, SP-1). Returns the
 * content and `usage.prompt_tokens`, the only sign of a silently cut prompt (contextGuard.ts), and `cutAt` when
 * the reply stopped at max_tokens (F-095). A timeout or a cancel throws a `CallCut`: Ollama may still be
 * generating that reply, so the release waits longer for its model (ollamaControl, D-259).
 */
import type { PlannerTarget } from './ollamaControl.js';
import type { ChatMessage, PlannerReply } from './planTypes.js';

export interface ChatOptions {
  timeoutMs: number;
  /** Aborts the call (CANCEL on a running plan, D-041). */
  signal?: AbortSignal;
  /** Completion budget; default MAX_TOKENS (a chat turn that may edit asks 4000, SP-5). */
  maxTokens?: number;
}

/** A call the client gave up on (timed out or cancelled) while `model` may still be generating its reply. */
export class CallCut extends Error {
  constructor(message: string, readonly model: string, readonly why: string) { super(message); }
}

/** SP-2's settings: low temperature, room for 6 ops of chords. */
const TEMPERATURE = 0.3;
const MAX_TOKENS = 2000;

export function chatBody(model: string, messages: ChatMessage[], schema: Record<string, unknown>, maxTokens = MAX_TOKENS) {
  return {
    model, messages, stream: false, temperature: TEMPERATURE, max_tokens: maxTokens,
    reasoning_effort: 'none',
    response_format: { type: 'json_schema', json_schema: { name: 'ops', strict: true, schema } },
  };
}

export async function askPlanner(
  t: PlannerTarget, messages: ChatMessage[], schema: Record<string, unknown>, o: ChatOptions,
): Promise<PlannerReply> {
  const signals = [AbortSignal.timeout(o.timeoutMs), ...(o.signal ? [o.signal] : [])];
  let res: Response;
  try {
    res = await fetch(`${t.url}/v1/chat/completions`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(chatBody(t.model, messages, schema, o.maxTokens)), signal: AbortSignal.any(signals),
    });
  } catch (err) {
    if (o.signal?.aborted) throw new CallCut('planner call cancelled', t.model, 'cancelled');
    const s = Math.round(o.timeoutMs / 1000);
    if (err instanceof Error && err.name === 'TimeoutError') throw new CallCut(`planner -> no answer within ${s}s`, t.model, `timed out after ${s} s`);
    throw new Error(`planner offline: no answer from ${t.url} (${err instanceof Error ? err.message : String(err)})`);
  }
  if (res.status === 404) throw new Error(`planner model ${t.model} not found: run 'ollama pull ${t.model}'`);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`planner -> HTTP ${res.status}${text ? `: ${text.slice(0, 200)}` : ''}`);
  }
  const body = (await res.json()) as { choices?: Array<{ message?: { content?: unknown }; finish_reason?: unknown }>; usage?: { prompt_tokens?: unknown } };
  const content = body.choices?.[0]?.message?.content;
  const promptTokens = body.usage?.prompt_tokens;
  const cut = body.choices?.[0]?.finish_reason === 'length' ? { cutAt: o.maxTokens ?? MAX_TOKENS } : {};
  return { content: typeof content === 'string' ? content : '', promptTokens: typeof promptTokens === 'number' ? promptTokens : null, ...cut };
}
