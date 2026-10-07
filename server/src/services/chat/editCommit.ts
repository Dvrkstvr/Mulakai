/**
 * APPLY on an edit card (F-047, F-048 #1, F-049 #1 and edge; scope "A turn, end to end" step 6): re-checked at
 * the click: the card's proposal is the live one of a song thread, no APPLY of this thread is running, and
 * checkRender (the plan alive, the base version unchanged, no edit queued after the plan, no planner on the
 * GPU). A song changed since the plan is `stale`: no job starts and the card reads STALE (ASK AGAIN). Then
 * the chat edit job (spliceRenderJob) with the card's own splice verdict, made at plan time on the same
 * song (the fingerprint says it is unchanged). When the version is saved the version card follows, carrying
 * the job id, so the edit card reads done; the edit card keeps the job id, so a reload finds it committing. An
 * APPLY that ends with nothing saved clears it, so after a restart a job id still there reads INTERRUPTED (F-049 #3).
 */
import { db } from '../../db/index.js';
import { QueueFullError } from '../genQueue.js';
import { getJob, type Job } from '../jobRegistry.js';
import { CHANGED_SINCE_PLAN } from '../score/scoreEligibility.js';
import { checkRender, renderDeps, type RenderDeps } from '../score/scoreRenderJob.js';
import type { EditBody } from './chatTypes.js';
import { appendMessage, messageById, updateMessage } from './messageStore.js';
import { editById, proposalLife } from './proposalStore.js';
import { startEditRender, type EditSaved } from './spliceRenderJob.js';
import { threadById } from './threadStore.js';
import { versionCard, versionCardText } from './versionCard.js';

export const STALE = 'this song changed since the proposal';

export interface EditCommitDeps {
  render: RenderDeps;
  start: typeof startEditRender;
}

export function editCommitDeps(over: Partial<EditCommitDeps> = {}): EditCommitDeps {
  return { render: renderDeps(), start: startEditRender, ...over };
}

export type ApplyOutcome = { job: Job } | { reason: string; stale?: boolean };

const CHECKING = ''; // the guard taken before the first await, so a second APPLY (another tab) is refused
const applies = new Map<string, string>(); // threadId -> the running APPLY's job id, or CHECKING
const running = (jobId: string | undefined) =>
  jobId === CHECKING || ['queued', 'loading', 'running'].includes(jobId ? getJob(jobId)?.status ?? '' : '');

/** The version card, after the edit card that made it. */
function landed(threadId: string, jobId: string, saved: EditSaved): void {
  const { version, splice, previous } = saved;
  const label = (db.prepare(`SELECT label FROM versions WHERE id = ?`).get(version.id) as { label: string } | undefined)?.label ?? '';
  const card = versionCard({ number: version.number, seconds: version.seconds, label, truncated: version.truncated, splice }, previous);
  appendMessage(threadId, { role: 'assistant', kind: 'version', text: versionCardText(card), body: card, versionId: version.id, jobId });
}

/** An APPLY ended with nothing saved (failed, refused, cancelled running or queued): its edit card drops the job id,
 * so only an APPLY a restart cut leaves a job id the server does not know (INTERRUPTED, F-049 #3). */
export function applyEnded(jobId: string): void {
  if (jobId) db.prepare(`UPDATE chat_messages SET job_id = NULL WHERE job_id = ? AND kind = 'edit'`).run(jobId);
}

export async function applyEdit(threadId: string, proposalId: string, deps: EditCommitDeps = editCommitDeps()): Promise<ApplyOutcome> {
  if (running(applies.get(threadId))) return { reason: 'APPLY is already running for this song' };
  applies.set(threadId, CHECKING);
  try {
    const out = await checkAndStart(threadId, proposalId, deps);
    if ('job' in out) applies.set(threadId, out.job.id);
    else applies.delete(threadId);
    return out;
  } catch (err) {
    applies.delete(threadId);
    throw err;
  }
}

async function checkAndStart(threadId: string, proposalId: string, deps: EditCommitDeps): Promise<ApplyOutcome> {
  const thread = threadById(threadId);
  if (!thread) return { reason: 'this chat no longer exists' };
  const proposal = editById(proposalId);
  const life = proposal?.threadId === threadId ? proposalLife(proposalId) : null;
  if (!proposal || !life || !thread.songId) return { reason: 'this proposal expired: ask again' };
  if (life === 'superseded') return { reason: 'a newer plan replaced this one' };
  const card = messageById(proposal.messageId);
  const body = card?.body as EditBody | null;
  if (!card || !body?.splice) return { reason: 'this proposal expired: ask again' };
  const songId = thread.songId;
  const checked = await checkRender(songId, proposal.planId, deps.render, true);
  if ('refusal' in checked) {
    if (!checked.stale) return { reason: checked.refusal, stale: false };
    const reason = checked.refusal === CHANGED_SINCE_PLAN ? STALE : `${STALE}: ${checked.refusal}`;
    updateMessage(card.id, { body: { ...body, stale: reason } });
    return { reason, stale: true };
  }
  let jobId = '';
  let job: Job;
  try {
    job = deps.start(songId, proposal.planId, body.splice, (saved) => landed(threadId, jobId, saved), deps.render, () => applyEnded(jobId));
  } catch (err) {
    if (err instanceof QueueFullError) return { reason: err.message };
    throw err;
  }
  jobId = job.id;
  updateMessage(card.id, { jobId: job.id });
  return { job };
}
