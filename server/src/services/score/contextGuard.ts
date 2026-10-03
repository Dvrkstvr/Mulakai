/** Never plan against a truncated prompt (F-020 #3, R-015). Ollama answers an overflowing prompt
 * with HTTP 200 and a normal reply, having kept only the head and tail (about half the context);
 * the only sign is `usage.prompt_tokens` (SP-2). Pure: values in, the refusal text or null out. */

/** Tokens left for the reply on top of the prompt (SP-1/SP-2: context >= prompt + 2,500). */
export const CONTEXT_RESERVE = 2500;
/** What the planner needs, for the fix in the refusal (D-045). */
export const CONTEXT_FIX = 'set OLLAMA_CONTEXT_LENGTH=16384';

/** Fewest tokens a prompt of this size can be: under it, the server cut the prompt. Six
 * characters per token is well above what BPE tokenizers give for English and bar-map text. */
export const minPromptTokens = (chars: number) => Math.floor(chars / 6);
/** About how many tokens the prompt is, for the "needs about N" figure. */
export const expectedPromptTokens = (chars: number) => Math.ceil(chars / 3);

function refusal(contextLength: number | null, tokens: number): string {
  const needs = Math.round((tokens + CONTEXT_RESERVE) / 100) * 100;
  return `planner context is ${contextLength ?? 'unknown'}, needs about ${needs}: ${CONTEXT_FIX}`;
}

/** Before the call, when `/api/ps` already lists the model: refuse a context that cannot hold it. */
export function contextPreflight(p: { promptChars: number; contextLength: number | null }): string | null {
  if (p.contextLength === null) return null;
  if (p.contextLength >= minPromptTokens(p.promptChars) + CONTEXT_RESERVE) return null;
  return refusal(p.contextLength, expectedPromptTokens(p.promptChars));
}

/** After each call: the server must have read the whole prompt and left the reserve. */
export function contextPostflight(p: { promptTokens: number | null; promptChars: number; contextLength: number | null }): string | null {
  const expected = expectedPromptTokens(p.promptChars);
  if (p.promptTokens === null) {
    return `the planner did not report usage.prompt_tokens, so a cut prompt cannot be ruled out (${CONTEXT_FIX} on an Ollama server)`;
  }
  const truncated = p.promptTokens < minPromptTokens(p.promptChars);
  const tight = p.contextLength !== null && p.contextLength < p.promptTokens + CONTEXT_RESERVE;
  if (!truncated && !tight) return null;
  return refusal(p.contextLength, truncated ? Math.max(expected, p.promptTokens) : Math.max(p.promptTokens, minPromptTokens(p.promptChars)));
}
