/**
 * A turn's messages (SP-5 prompt.py build_messages): the rules as the system message; one user message
 * of the song-state block, the phrase lines when there is a song (reused phraseLines), the pending
 * proposal, the last turns (never the whole transcript) and the REQUEST. A retry reuses the planner's
 * retryMessages. Pure.
 */
import { phraseBarsOf, phraseLines } from '../score/phraseRequest.js';
import { retryMessages } from '../score/plannerPrompt.js';
import type { ChatMessage as PromptMessage, ScoreFacts } from '../score/planTypes.js';
import type { AskBody, ChatMessage, RecipeBody } from './chatTypes.js';

export const REPLY_LINE = 'Reply with the JSON object only.';
const RETRY_CLOSING = 'Return a corrected, complete reply as one JSON object only.';
const PENDING = 'PENDING PROPOSAL: the new-song card the person is looking at shows the SIDEBAR fields; nothing has run. '
  + 'A refinement answers with the complete updated recipe.';
const TEXT_MAX = 600;

const cut = (s: string) => (s.length > TEXT_MAX ? `${s.slice(0, TEXT_MAX)}…` : s);

/** The conversation so far, one line per message; failed turns are left out (they changed nothing). */
export function historyLines(messages: ChatMessage[]): string[] {
  return messages.flatMap((m): string[] => {
    if (m.role === 'user') return [`PERSON: ${cut(m.text)}`];
    if (m.kind === 'failed') return [];
    if (m.kind === 'ask') return [`ASSISTANT: ${cut(m.text)} (choices: ${((m.body as AskBody | null)?.choices ?? []).join(' / ')})`];
    if (m.kind === 'recipe') return [`ASSISTANT: ${cut(m.text)} [proposed a new-song card: "${(m.body as RecipeBody | null)?.recipe?.title ?? '?'}"]`];
    if (m.kind === 'song') return [`ASSISTANT: [the song was created: ${cut(m.text)}]`];
    if (m.kind === 'version') return [`ASSISTANT: [a new version was saved: ${cut(m.text)}]`];
    return [`ASSISTANT: ${cut(m.text)}`];
  });
}

export interface PromptInput {
  rules: string;
  /** songState's block. */
  state: string[];
  facts: ScoreFacts | null;
  request: string;
  /** A recipe card is pending on this thread. */
  pending: boolean;
  /** The last turns before this request. */
  history: ChatMessage[];
}

export function turnMessages({ rules, state, facts, request, pending, history }: PromptInput): PromptMessage[] {
  const convo = historyLines(history);
  const user = [
    ...state,
    ...(facts ? phraseLines(facts, phraseBarsOf(request)) : []),
    '',
    ...(pending ? [PENDING, ''] : []),
    ...(convo.length ? [`CONVERSATION (latest last):\n${convo.join('\n')}`, ''] : []),
    `REQUEST: ${request}`,
    REPLY_LINE,
  ].join('\n');
  return [{ role: 'system', content: rules }, { role: 'user', content: user }];
}

export function turnRetry(messages: PromptMessage[], reply: string, reasons: string[]): PromptMessage[] {
  return retryMessages(messages, reply, reasons, { closing: RETRY_CLOSING });
}
