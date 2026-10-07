/**
 * READ and RE-ANALYZE at the click (F-061 commit, F-062; architecture "Chat (C3)" flow 3 and 8).
 * READ re-checks the analyze card (alive, not read yet, a draft thread, nothing of this thread still
 * working, gpuGuard), makes the reference (a library song is copied now), then in one transaction
 * appends the reading card and queues the reading; the analyze card holds the reading's job id
 * (committing while it runs). When the reading saves, the follow-up turn re-asks the person's request
 * that led to the card and the reading card's job id moves to it (D-129); a follow-up that cannot
 * queue is a `failed` line. A READ whose reading saved nothing (failed, cancelled, lost) can be pressed again: the
 * same reference, a new reading card, the follow-up turn (C3 review 3). RE-ANALYZE: the same checks on a reference, a new reading card, no turn.
 */
import { db } from '../../db/index.js';
import { QueueFullError } from '../genQueue.js';
import { getJob, type Job } from '../jobRegistry.js';
import { takeRunning } from './createFromDraft.js';
import { gpuGuard } from './gpuGuard.js';
import { appendMessage, listMessages, messageById, updateMessage } from './messageStore.js';
import { analyzeById, proposalLife } from './proposalStore.js';
import { readingOf, startReading, type ReadingOptions } from './readingJob.js';
import { unreadCard } from './messageView.js';
import { materialise } from './readTarget.js';
import { fromLibrary, getReference, type Reference } from './referenceStore.js';
import { threadById } from './threadStore.js';
import { startChatTurn, turnDeps, turnOf } from './turnJob.js';
import type { ChatMessage, FailedBody, ReadingBody } from './chatTypes.js';

export const BUSY = 'the assistant, a reading or CREATE SONG is still working in this chat: wait for it or CANCEL';
export const ON_SONG = 'a reference starts a new song: press NEW CHAT and attach it there';

export interface ReadCommitDeps {
  guard: () => Promise<string | null>;
  start: (referenceId: string, opts: ReadingOptions) => Job;
  /** The follow-up turn (D-129): `origin` asked again with the REFERENCE block of `referenceId`. */
  followUp: (threadId: string, origin: ChatMessage, referenceId: string) => Job;
  library: typeof fromLibrary;
  /** A turn, a reading or a take of this thread is queued or running. */
  busy: (threadId: string) => boolean;
}

const threadBusy = (threadId: string): boolean =>
  takeRunning(threadId) || listMessages(threadId).some((m) => Boolean(m.jobId && (turnOf(m.jobId) || readingOf(m.jobId))));

export function readCommitDeps(over: Partial<ReadCommitDeps> = {}): ReadCommitDeps {
  return {
    guard: () => gpuGuard(),
    start: (referenceId, opts) => startReading(referenceId, opts),
    followUp: (threadId, origin, referenceId) => startChatTurn(threadId, origin, null, turnDeps(), { followUp: referenceId }),
    library: fromLibrary,
    busy: threadBusy,
    ...over,
  };
}

type Outcome = { job: Job } | { reason: string };
const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

/** The follow-up turn after the save; the reading card's job id moves to it. */
function handOff(threadId: string, cardId: string, origin: ChatMessage, referenceId: string, deps: ReadCommitDeps): void {
  try {
    updateMessage(cardId, { jobId: deps.followUp(threadId, origin, referenceId).id });
  } catch (err) {
    const body: FailedBody = { reasons: [`the reading is saved, but the assistant could not answer: ${message(err)}; ask again`], cause: 'offline' };
    appendMessage(threadId, { role: 'assistant', kind: 'failed', text: body.reasons[0], body });
  }
}

/** The reading card and its job, all or nothing (a full queue leaves no card). */
function begin(threadId: string, ref: Reference, deps: ReadCommitDeps, after: { analyzeId: string; origin: ChatMessage } | null): Outcome {
  try {
    return db.transaction((): Outcome => {
      const body: ReadingBody = { referenceId: ref.id, name: ref.name, followUp: Boolean(after), reading: null };
      const { message: card } = appendMessage(threadId, { role: 'assistant', kind: 'reading', text: `Reading ${ref.name}`, body });
      const onRead = after ? () => handOff(threadId, card.id, after.origin, ref.id, deps) : undefined;
      const job = deps.start(ref.id, { threadId, cardId: card.id, ...(onRead ? { onRead } : {}) });
      updateMessage(card.id, { jobId: job.id });
      if (after) updateMessage(after.analyzeId, { jobId: job.id });
      return { job };
    })();
  } catch (err) {
    if (err instanceof QueueFullError) return { reason: err.message };
    throw err;
  }
}

/** READ on an analyze card. */
export async function readFromCard(threadId: string, proposalId: string, deps: ReadCommitDeps = readCommitDeps()): Promise<Outcome> {
  const thread = threadById(threadId);
  if (!thread) return { reason: 'this chat no longer exists' };
  const proposal = analyzeById(proposalId);
  const life = proposal?.threadId === threadId ? proposalLife(proposalId) : null;
  if (!proposal || !life) return { reason: 'this proposal expired: ask again' };
  if (life === 'superseded') return { reason: 'a newer proposal replaced this one' };
  const card = messageById(proposal.messageId);
  if (!card) return { reason: 'this proposal expired: ask again' };
  const messages = listMessages(threadId);
  const unread = card.jobId ? unreadCard(card, messages, getJob(card.jobId)) : null;
  if (card.jobId && !unread) return { reason: 'this card was already read' };
  if (thread.songId) return { reason: ON_SONG };
  const origin = messages.filter((m) => m.role === 'user' && m.seq < card.seq).at(-1);
  if (!origin) return { reason: 'the request behind this card is gone: ask again' };
  if (deps.busy(threadId)) return { reason: BUSY };
  const refused = await deps.guard();
  if (refused) return { reason: refused };
  // READ again after a reading that saved nothing: the same reference (a library song is not copied twice).
  const again = unread ? getReference((unread.body as ReadingBody).referenceId) : null;
  const target = again?.threadId === threadId ? { reference: again } : await materialise(threadId, proposal.target, deps.library);
  if ('reason' in target) return target;
  return begin(threadId, target.reference, deps, { analyzeId: card.id, origin });
}

/** RE-ANALYZE from the song panel: the latest reading replaces the last one; no follow-up turn. */
export async function reread(referenceId: string, deps: ReadCommitDeps = readCommitDeps()): Promise<Outcome> {
  const ref = getReference(referenceId);
  if (!ref || !threadById(ref.threadId)) return { reason: 'this reference no longer exists' };
  if (deps.busy(ref.threadId)) return { reason: BUSY };
  const refused = await deps.guard();
  if (refused) return { reason: refused };
  return begin(ref.threadId, ref, deps, null);
}
