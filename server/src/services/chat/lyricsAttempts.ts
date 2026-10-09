/**
 * The lyrics call's retry loop (SP-5 ladder.py `lyrics_call`, the planner's shape): ask with the strict
 * schema, parse, check (lyricsCheck; a reply cut at max_tokens is a reason too, F-095), and on a rejection send the reply back with its reasons through the
 * score planner's `retryMessages`; at most MAX_ATTEMPTS asks. A thrown error (HTTP, timeout, a model not
 * pulled, cancel) ends it at once. The sections' tags come from the structure, never from the model.
 * One run per lyrics model: the caller loads that model and runs this. Pure (I/O injected).
 */
import { MAX_ATTEMPTS } from '../score/planAttempts.js';
import { retryMessages } from '../score/plannerPrompt.js';
import type { ChatMessage, PlannerReply } from '../score/planTypes.js';
import type { LyricSection } from './chatTypes.js';
import { lyricsProblems } from './lyricsCheck.js';
import { lyricsMessages, lyricsSchema, sungTags, type LyricsRequest } from './lyricsPrompt.js';
import type { DetectLanguage } from './replyGuards.js';

/** Reasons sent back per attempt; more only buries the first ones. */
const MAX_REASONS = 8;
const RETRY = { heading: 'Your lyrics were rejected:', closing: 'Return corrected, complete lyrics as JSON only: {"sections": [{"lines": [...]}, ...]}.' };

export const cutReason = (tokens: number) => `your answer was cut at ${tokens} tokens: shorter lines, exactly the listed sections`;

export interface LyricsDeps {
  ask: (messages: ChatMessage[], schema: Record<string, unknown>) => Promise<PlannerReply>;
  detect: DetectLanguage;
  /** The caller's own checks on the tagged sections (turnCall: the whole recipe's, recipeRules), each a retry reason. */
  more?: (lyrics: LyricSection[]) => string[];
  /** Attempt n starts; `reason` is the first thing wrong with the previous one. */
  onAttempt?: (n: number, reason?: string) => void;
}

export type LyricsOutcome =
  | { ok: true; lyrics: LyricSection[]; attempts: number }
  | { ok: false; reasons: string[]; attempts: number };

function parse(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    return undefined;
  }
}

export async function writeLyrics(input: LyricsRequest, deps: LyricsDeps, maxAttempts = MAX_ATTEMPTS): Promise<LyricsOutcome> {
  const tags = sungTags(input.structure);
  if (!tags.length) return { ok: true, lyrics: [], attempts: 0 };
  const schema = lyricsSchema(tags.length);
  let msgs = lyricsMessages(input);
  let reasons: string[] = [];
  for (let n = 1; n <= maxAttempts; n++) {
    deps.onAttempt?.(n, reasons[0]);
    const reply = await deps.ask(msgs, schema);
    const json = reply.cutAt ? undefined : parse(reply.content);
    reasons = reply.cutAt ? [cutReason(reply.cutAt)] // F-095: a cut reply is retried shorter, not a failed turn
      : json === undefined ? ['the reply is not valid JSON'] : await lyricsProblems(json, input, deps.detect);
    const lyrics = reasons.length ? [] : (json as { sections: Array<{ lines: string[] }> }).sections.map((s, i) => ({ tag: tags[i], lines: s.lines }));
    if (!reasons.length) reasons = deps.more?.(lyrics) ?? [];
    if (!reasons.length) return { ok: true, lyrics, attempts: n };
    reasons = reasons.slice(0, MAX_REASONS);
    msgs = retryMessages(msgs, reply.content, reasons, RETRY);
  }
  return { ok: false, reasons, attempts: maxAttempts };
}
