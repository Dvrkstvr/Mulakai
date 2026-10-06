/** The planner's messages (SP-2 v2 prompt): rules as the system message, then the song as
 * facts and a bar map from yue-server (never the raw score), the phrase length N and the free
 * bars (F-026), the stored style and the request;
 * a retry appends the reply and the per-op reasons it was rejected for. Pure. */
import { phraseBarsOf, phraseLines } from './phraseRequest.js';
import { PLANNER_RULES } from './plannerRules.js';
import type { ChatMessage, ScoreFacts } from './planTypes.js';

/** `context`: lines told just before the REQUEST: what "this" means (planReferent) and a REVISE's pending
 * plan (planRevise); none for a PLAN of the whole song. */
export function planMessages(
  facts: ScoreFacts, style: string, request: string, context: string[] = [], replyLine = 'Reply with the JSON op list only.',
): ChatMessage[] {
  const h = facts.header;
  const sections = facts.sections.map((s) => `S${s.index} ${s.label}: bars ${s.from_bar}-${s.to_bar}`).join('\n');
  // "[Chorus] #2" with its number, so "the second chorus" resolves to one block (F-031 #2).
  const blocks = facts.lyric_blocks.map((b) => `${b.index}: ${b.tag} #${b.occurrence}, ${b.lines} lines`
    + (b.first_line ? `, first line: ${b.first_line}` : '')).join('\n');
  const user = [
    `HEADER: M:${h.meter} L:${h.unit} Q:1/4=${h.bpm} K:${h.key}; ${h.bars} bars, about ${Math.round(h.seconds)} s (the hard limit is 360 s)`,
    `KEY NOTES (${h.key}; the key signature already applies the sharps/flats): ${facts.key_notes}`,
    `STYLE: ${style}`,
    '',
    `SECTIONS:\n${sections || '(none marked)'}`,
    '',
    `LYRIC BLOCKS (block: tag #occurrence):\n${blocks || '(none)'}`,
    '',
    `BAR MAP (bar: chords@beat | vocal | number of Ins notes):\n${facts.bar_map.join('\n')}`,
    '',
    ...phraseLines(facts, phraseBarsOf(request)),
    '',
    ...(context.length ? [...context, ''] : []),
    `REQUEST: ${request}`,
    replyLine,
  ].join('\n');
  return [{ role: 'system', content: PLANNER_RULES }, { role: 'user', content: user }];
}

/** `legend`: how a REVISE reply became the plan the reasons number (reviseReply); `closing`: the ask;
 * `heading`: the first line (a chat turn's reply is not an op list, D-114 i). */
export function retryMessages(
  messages: ChatMessage[], reply: string, reasons: string[],
  { legend, closing, heading = 'Your op list was rejected:' }: { legend?: string; closing?: string; heading?: string } = {},
): ChatMessage[] {
  const feedback = `${heading}\n${legend ? `${legend}\n` : ''}${reasons.map((r) => `- ${r}`).join('\n')}\n`
    + (closing ?? 'Return a corrected, complete op list as JSON only.');
  return [...messages, { role: 'assistant', content: reply }, { role: 'user', content: feedback }];
}

/** Characters of everything sent: the context guard's basis for the expected prompt size. */
export function promptChars(messages: ChatMessage[]): number {
  return messages.reduce((n, m) => n + m.content.length, 0);
}
