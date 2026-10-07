/**
 * A turn's messages (SP-5 prompt.py build_messages, v3.1): the rules as the system message; one user
 * message of the song-state block, the phrase lines when there is a song (reused phraseLines), the
 * pending proposal (songState.draftLines), the last turns as PERSON / ASSISTANT lines with a one-line
 * card summary built from the card's fields (never the whole transcript), the REQUEST and the
 * compact-JSON reply line. C3: the ATTACHED / REFERENCE lines come in the state block (songStateSource);
 * a READ card and a reading card are one history line each. A retry reuses the planner's
 * retryMessages with the chat's own wording (D-114 i). Budgets: SP-5 RESULT item 5. Pure.
 */
import { phraseBarsOf, phraseLines } from '../score/phraseRequest.js';
import { retryMessages } from '../score/plannerPrompt.js';
import type { ChatMessage as PromptMessage, ScoreFacts } from '../score/planTypes.js';
import type { AnalyzeBody, AskBody, ChatMessage, ReadingBody, RecipeBody } from './chatTypes.js';

/** SP-5 v2: one compact line cuts 20-35% of the completion tokens. */
export const REPLY_LINE = 'Reply with the JSON object only, compact on ONE line (no newlines, no indentation).';
const RETRY_HEADING = 'Your reply was rejected:';
const RETRY_CLOSING = `Return a corrected, complete reply. ${REPLY_LINE}`;
/** One message in the history, and the whole history: 0.8k tokens at 3 characters a token. */
const TEXT_MAX = 300;
export const HISTORY_MAX = 2400;
const STYLE_MAX = 80;

const cut = (s: string, n = TEXT_MAX) => (s.length > n ? `${s.slice(0, n)}…` : s);

/** SP-5 history_text: what the card proposed, from its fields (the message may contradict them). */
function cardSummary(body: RecipeBody | null): string {
  const r = body?.recipe;
  if (!r) return '[new-song card]';
  const use = body?.reference ? (body.reference.use === 'cover' ? 'a cover of the reference' : 'borrows from the reference') : '';
  const parts = [`"${r.title}"`, cut(r.style, STYLE_MAX), r.bpm !== undefined ? `${r.bpm} bpm` : '', r.key ?? '', r.language, use];
  return `[new-song card: ${parts.filter(Boolean).join(' · ')}]`;
}

function line(m: ChatMessage): string | null {
  if (m.role === 'user') return `PERSON: ${cut(m.text)}`;
  switch (m.kind) {
    case 'failed': return null;
    case 'ask': return `ASSISTANT: ${cut(m.text)} (choices: ${((m.body as AskBody | null)?.choices ?? []).join(' / ')})`;
    case 'recipe': return `ASSISTANT: ${cut(m.text)} ${cardSummary(m.body as RecipeBody | null)}`;
    case 'analyze': return `ASSISTANT: ${cut(m.text)} [READ card for "${(m.body as AnalyzeBody | null)?.name ?? 'a reference'}"]`;
    case 'reading': {
      const r = m.body as ReadingBody | null;
      return `ASSISTANT: [the reference "${r?.name ?? ''}" ${r?.reading ? 'was read' : `is not read: ${cut(m.text)}`}]`;
    }
    case 'song': return `ASSISTANT: [the song was created: ${cut(m.text)}]`;
    case 'version': return `ASSISTANT: [a new version was saved: ${cut(m.text)}]`;
    default: return `ASSISTANT: ${cut(m.text)}`;
  }
}

/** The conversation so far, one line per message, failed turns left out (they changed nothing);
 * the oldest lines go first when the history is over its budget. */
export function historyLines(messages: ChatMessage[]): string[] {
  const lines = messages.map(line).filter((l): l is string => l !== null);
  let size = lines.reduce((n, l) => n + l.length + 1, 0);
  while (lines.length && size > HISTORY_MAX) size -= lines.shift()!.length + 1;
  return lines;
}

export interface PromptInput {
  rules: string;
  /** songState's block. */
  state: string[];
  facts: ScoreFacts | null;
  request: string;
  /** songState.draftLines: the pending card or the sidebar; empty when there is none. */
  pending: string[];
  /** The last turns before this request. */
  history: ChatMessage[];
  /** C1 (F-055): markBlock's MARK lines, after the song state; absent = the whole song. */
  mark?: string[];
}

export function turnMessages({ rules, state, facts, request, pending, history, mark = [] }: PromptInput): PromptMessage[] {
  const convo = historyLines(history);
  const user = [
    ...state,
    ...(facts ? phraseLines(facts, phraseBarsOf(request)) : []),
    ...(mark.length ? ['', ...mark] : []),
    '',
    ...(pending.length ? [...pending, ''] : []),
    ...(convo.length ? [`CONVERSATION (latest last):\n${convo.join('\n')}`, ''] : []),
    `REQUEST: ${request}`,
    REPLY_LINE,
  ].join('\n');
  return [{ role: 'system', content: rules }, { role: 'user', content: user }];
}

export function turnRetry(messages: PromptMessage[], reply: string, reasons: string[]): PromptMessage[] {
  return retryMessages(messages, reply, reasons, { heading: RETRY_HEADING, closing: RETRY_CLOSING });
}
