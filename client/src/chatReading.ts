/** The analyze and reading cards' life (F-061, D-129, D-136): an analyze card pending → READ (starting, or refused
 * with the reason) → done; its reading card queued "STARTS AFTER n" → reading step k of WORDS > SCORE > CAPTION →
 * PROPOSING… (the follow-up turn) → done | partial | failed | cancelled | interrupted. Built from the server's
 * `MessageView` and the card's job polls; only this reducer moves these cards. Pure. */
import type { ChatMessageView, ChatReadingBody } from './api/chat';
import { isNotRead, type ReadingView } from './api/chatReferences';
import type { TurnJobPoll } from './chatTurn';

export const READING_STEPS = ['WORDS', 'SCORE', 'CAPTION'] as const;
export type ReadingStep = (typeof READING_STEPS)[number];

export type CardPhase =
  | { kind: 'pending' } | { kind: 'superseded' } | { kind: 'expired' }
  /** READ pressed; the POST is in flight. Its button never turns into progress. */
  | { kind: 'starting' }
  /** The server's re-check refused READ (proposal gone, a model loaded): the card is live again with the reason. */
  | { kind: 'refused'; reason: string }
  | { kind: 'queued'; ahead: number }
  | { kind: 'reading'; step: number; name: ReadingStep; note: string | null }
  /** The reading is saved; the follow-up turn the server queued is running (D-129). */
  | { kind: 'proposing' }
  /** `partial` = a part says "not read: <why>". An analyze card is done once its reading card exists. */
  | { kind: 'done'; partial: boolean }
  | { kind: 'failed'; error: string }
  | { kind: 'cancelled' }
  | { kind: 'interrupted' };

/** `stage`: whose job `jobId` is, the reading's or the follow-up turn's (the card's job id moves to it). */
export interface CardState { phase: CardPhase; jobId: string | null; stage: 'read' | 'followUp' | null }
export interface ReadingState { cards: Record<string, CardState> }
export const INITIAL_READING: ReadingState = { cards: {} };

export type ReadingEvent =
  /** The thread as the server sent it (open, refetch). */
  | { type: 'thread'; messages: ChatMessageView[] }
  | { type: 'read'; messageId: string }
  | { type: 'refused'; messageId: string; reason: string }
  | { type: 'poll'; messageId: string; job: TurnJobPoll & { error?: string } }
  /** The card's job is gone (404, the server stopped answering). */
  | { type: 'lost'; messageId: string };

const RUNNING = new Set<CardPhase['kind']>(['starting', 'queued', 'reading', 'proposing']);
export const cardRunning = (c: CardState | undefined): boolean => !!c && RUNNING.has(c.phase.kind);
/** SEND is off from READ until the follow-up turn settles (D-129; the server answers 409 TURN_OPEN too). */
export const readingHoldsSend = (s: ReadingState): boolean => Object.values(s.cards).some(cardRunning);
/** The jobs to poll: running cards that have one. */
export const runningCards = (s: ReadingState): { messageId: string; jobId: string }[] =>
  Object.entries(s.cards).filter(([, c]) => cardRunning(c) && c.jobId).map(([messageId, c]) => ({ messageId, jobId: c.jobId! }));

/** The follow-up turn's reply: the first assistant line after the card that is not another card (a recipe, ask, say
 * or failed); its `changed` fields get the sidebar's marks when it lands. */
export function replyAfter(messages: ChatMessageView[], messageId: string): ChatMessageView | null {
  const i = messages.findIndex((m) => m.id === messageId);
  if (i < 0) return null;
  const after = messages.slice(i + 1);
  const end = after.findIndex((m) => m.role === 'user');
  return (end < 0 ? after : after.slice(0, end)).find((m) => !['song', 'version', 'analyze', 'reading'].includes(m.kind)) ?? null;
}

export const readingPartial =(r: ReadingView | null | undefined): boolean =>
  !!r && [r.words, r.score, r.caption].some(isNotRead);

/** "SCORE · transcribing 41%" → step 2, SCORE, the note; text naming no step keeps `prevStep` and is the note. */
export function stepOf(text: string | undefined, prevStep: number): { step: number; name: ReadingStep; note: string | null } {
  const m = text?.match(/^\s*(words|score|caption)\b\s*(?:·\s*)?(.*)$/i);
  if (!m) {
    const step = Math.min(Math.max(prevStep, 1), READING_STEPS.length);
    return { step, name: READING_STEPS[step - 1], note: text?.trim() || null };
  }
  const name = m[1].toUpperCase() as ReadingStep;
  return { step: READING_STEPS.indexOf(name) + 1, name, note: m[2].trim() || null };
}

function fromAnalyze(m: ChatMessageView): CardPhase | null {
  switch (m.state) {
    case 'pending': case 'superseded': case 'expired': return { kind: m.state };
    case 'committing': return { kind: 'starting' };
    case 'done': return { kind: 'done', partial: false };
    default: return null;
  }
}

function fromReadingCard(m: ChatMessageView): { phase: CardPhase; stage: CardState['stage'] } | null {
  const reading = (m.body as ChatReadingBody | null)?.reading ?? null;
  const read = { stage: 'read' as const };
  switch (m.state) {
    case 'queued':
      return reading ? { phase: { kind: 'proposing' }, stage: 'followUp' } : { ...read, phase: { kind: 'queued', ahead: m.job?.queuePosition ?? 0 } };
    case 'reading': return { ...read, phase: { kind: 'reading', ...stepOf(m.job?.progressText, 1) } };
    case 'thinking': return { phase: { kind: 'proposing' }, stage: 'followUp' };
    case 'done': return { phase: { kind: 'done', partial: readingPartial(reading) }, stage: null };
    case 'failed': return { phase: { kind: 'failed', error: m.job?.error || m.text || 'the reading failed' }, stage: null };
    case 'cancelled': case 'interrupted': return { phase: { kind: m.state }, stage: null };
    default: return null;
  }
}

/** One card from the thread; a live poll-derived phase of the same job and stage wins while both say running. */
function fromThread(prev: CardState | undefined, m: ChatMessageView): CardState | null {
  if (m.kind === 'analyze') {
    const phase = fromAnalyze(m);
    if (!phase) return null;
    const waiting = prev && (prev.phase.kind === 'starting' || prev.phase.kind === 'refused');
    return waiting && phase.kind === 'pending' ? prev : { phase, jobId: null, stage: null };
  }
  const next = fromReadingCard(m);
  if (!next) return null;
  const card: CardState = { ...next, jobId: m.jobId };
  if (prev && cardRunning(prev) && RUNNING.has(card.phase.kind) && prev.jobId === card.jobId && prev.stage === card.stage) return prev;
  return card;
}

function onPoll(c: CardState, job: TurnJobPoll): CardState {
  const p = c.phase;
  if (c.stage === 'followUp') return job.cancelled ? { ...c, phase: { kind: 'done', partial: false }, stage: null } : c;
  if (job.cancelled) return { ...c, phase: { kind: 'cancelled' }, stage: null };
  if (job.status === 'queued') return { ...c, phase: { kind: 'queued', ahead: job.queuePosition ?? (p.kind === 'queued' ? p.ahead : 0) } };
  if (job.status === 'loading' || job.status === 'running') {
    return { ...c, phase: { kind: 'reading', ...stepOf(job.progressText, p.kind === 'reading' ? p.step : 1) } };
  }
  return c; // done / failed: the thread says how
}

export function chatReading(s: ReadingState, e: ReadingEvent): ReadingState {
  if (e.type === 'thread') {
    const cards: Record<string, CardState> = {};
    for (const m of e.messages) {
      if (m.kind !== 'analyze' && m.kind !== 'reading') continue;
      const c = fromThread(s.cards[m.id], m);
      if (c) cards[m.id] = c;
    }
    return { cards };
  }
  const c = s.cards[e.messageId];
  if (!c) return s;
  const put = (next: CardState): ReadingState => (next === c ? s : { cards: { ...s.cards, [e.messageId]: next } });
  switch (e.type) {
    case 'read': return c.phase.kind === 'pending' || c.phase.kind === 'refused' ? put({ ...c, phase: { kind: 'starting' } }) : s;
    case 'refused': return c.phase.kind === 'starting' ? put({ ...c, phase: { kind: 'refused', reason: e.reason } }) : s;
    case 'poll': return cardRunning(c) ? put(onPoll(c, e.job)) : s;
    case 'lost': return cardRunning(c) && c.jobId ? put({ ...c, phase: { kind: 'interrupted' }, stage: null }) : s;
  }
}
