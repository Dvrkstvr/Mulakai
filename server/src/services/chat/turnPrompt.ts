/**
 * A turn's messages (SP-5 prompt.py build_messages, v3.1): the rules as the system message; one user
 * message of the song-state block, the phrase lines when there is a song (reused phraseLines), the
 * pending proposal (songState.draftLines), the last turns as PERSON / ASSISTANT lines with a one-line
 * card summary built from the card's fields (never the whole transcript), the REQUEST and the
 * compact-JSON reply line. C3: the ATTACHED / REFERENCE lines come in the state block (songStateSource);
 * a READ card and a reading card are one history line each. A retry reuses the planner's
 * retryMessages with the chat's own wording (D-114 i), built on the first attempt's messages with each
 * refused reply shortened (C1 re-check N4: the whole reply re-sent made attempt 3 9.1k tokens; its message
 * is left out too, so a replan does not repeat what was refused, N2). Budgets: SP-5 RESULT item 5. Pure.
 */
import { phraseBarsOf, phraseLines } from '../score/phraseRequest.js';
import { retryMessages } from '../score/plannerPrompt.js';
import type { ChatMessage as PromptMessage, ScoreFacts } from '../score/planTypes.js';
import type { AnalyzeBody, AskBody, ChatMessage, ReadingBody, RecipeBody } from './chatTypes.js';

/** SP-5 v2: one compact line cuts 20-35% of the completion tokens. */
export const REPLY_LINE = 'Reply with the JSON object only, compact on ONE line (no newlines, no indentation).';
const RETRY_HEADING = 'Your reply was rejected:';
const RETRY_CLOSING = `Return a corrected, complete reply; write its message anew, about the corrected reply only. ${REPLY_LINE}`;
/** A refused reply that is not an edit (a say, a recipe) goes back as is up to this; one reason up to REASON_MAX. */
const REFUSED_MAX = 1200;
const REASON_MAX = 300;
/** An op's fields that place it; arrays (chords, bars, lines) go back as their length. */
const PLACE = ['bpm', 'semitones', 'from_bar', 'to_bar', 'start_bar', 'instrument', 'section', 'label', 'block', 'tag', 'occurrence'];
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

function opLine(op: unknown, i: number): string {
  if (typeof op !== 'object' || op === null) return `${i + 1} (not an op)`;
  const o = op as Record<string, unknown>;
  const fields = Object.entries(o).filter(([k]) => k !== 'op').flatMap(([k, v]) => {
    if (Array.isArray(v)) return [`${k}: ${v.length}`];
    return PLACE.includes(k) && (typeof v === 'number' || typeof v === 'string') ? [`${k}=${cut(String(v), 40)}`] : [];
  });
  return `${i + 1} ${String(o.op)}${fields.length ? ` ${fields.join(' ')}` : ''}`;
}

/** A refused reply as it goes back: an edit as its op kinds and bars (the chords are what made a retry 2.3k
 * tokens), anything else as is up to REFUSED_MAX; never its message (N2). */
export function refusedReply(content: string): string {
  let json: unknown;
  try { json = JSON.parse(content); } catch { return `(not valid JSON: ${cut(content, 200)})`; }
  if (typeof json !== 'object' || json === null || Array.isArray(json)) return cut(content, REFUSED_MAX);
  const { message: _message, ops, ...rest } = json as Record<string, unknown>;
  if (!Array.isArray(ops)) return cut(JSON.stringify(rest), REFUSED_MAX);
  const head = typeof rest.action === 'string' ? `action ${rest.action}` : 'no action';
  return `(your refused reply, shortened: ${head}; ops: ${ops.map(opLine).join(' | ') || 'none'})`;
}

/** Attempt n's messages: the first attempt's, then each refused reply (shortened) and its reasons. */
export function turnRetry(first: PromptMessage[], refused: Array<{ reply: string; reasons: string[] }>): PromptMessage[] {
  return refused.reduce((msgs, r) => retryMessages(msgs, refusedReply(r.reply), r.reasons.map((x) => cut(x, REASON_MAX)),
    { heading: RETRY_HEADING, closing: RETRY_CLOSING }), first);
}
