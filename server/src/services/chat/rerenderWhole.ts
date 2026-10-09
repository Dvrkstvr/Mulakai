/**
 * RE-RENDER WHOLE SONG (F-066 #5, D-268): on the version card of the song's active version, when that version was
 * spliced (its `params.splice` is a splice, not a fallback). No model call and no GPU slot: the server builds a no-op
 * plan on that version (its own saved score, style and lyrics, `ops: []`) with the score agent's own planBuild, and
 * appends a normal pending edit card whose splice verdict is "the whole song" with the reason. APPLY then takes the
 * existing whole-song path (consequence line, queue, cancel, stale rules). yue-server's apply refuses an empty op list
 * (`min_length=1`), so the plan's apply result is the version's score passed through unread (the ABC stays opaque
 * here: decisions/0002); the 360 s / token limits are the read's numbers, refused with scoreLimits' own lines.
 */
import crypto from 'node:crypto';
import { db } from '../../db/index.js';
import { getJob } from '../jobRegistry.js';
import { buildPlan } from '../score/planBuild.js';
import { setPlan } from '../score/planStore.js';
import { limitReasons, NO_CHANGE } from '../score/scoreLimits.js';
import { scoreStatus, type ScoreStatus } from '../score/scoreStatus.js';
import type { ApplyResult, ScoreFacts } from '../score/planTypes.js';
import { appendMessage, listMessages } from './messageStore.js';
import { propose } from './proposalStore.js';
import { threadById } from './threadStore.js';
import type { VersionCardBody } from './versionCard.js';
import type { EditBody } from './chatTypes.js';

export const WHOLE_REASON = 'you asked for the whole song re-rendered';
export const APPLY_RUNNING = 'APPLY is already running for this song';
export const NOT_IN_CHAT = 'that version has no card in this chat';
export const notActive = (n: number) => `v${n} is not the active version: only the active version can be re-rendered whole`;
export const notSpliced = (n: number) => `v${n} is already a whole-song render: there is no splice to re-render`;
export const cardText = (n: number) =>
  `This re-renders the whole song from v${n}'s own score and style: the score does not change, every bar is sung again.`;

export interface RerenderDeps { status: (songId: string) => Promise<ScoreStatus> }
export const rerenderDeps = (over: Partial<RerenderDeps> = {}): RerenderDeps => ({ status: (songId) => scoreStatus(songId), ...over });

/** `missing`: the chat or the version card is not there (404), else a refusal the card shows (409). */
export type RerenderOutcome = { messageId: string; proposalId: string } | { reason: string; missing?: true };

const live = (jobId: string | null) => ['queued', 'loading', 'running'].includes(jobId ? getJob(jobId)?.status ?? '' : '');

/** The version's stored record says it was spliced (a v1 or later splice row, not `{fallback}`). */
function spliced(versionId: string): boolean {
  const row = db.prepare(`SELECT params_json FROM versions WHERE id = ?`).get(versionId) as { params_json: string | null } | undefined;
  try {
    const splice = (JSON.parse(row?.params_json ?? '{}') as { splice?: unknown }).splice;
    return Boolean(splice && typeof splice === 'object' && !('fallback' in splice));
  } catch {
    return false;
  }
}

export async function rerenderWhole(threadId: string, versionId: string, deps: RerenderDeps = rerenderDeps()): Promise<RerenderOutcome> {
  const thread = threadById(threadId);
  if (!thread?.songId) return { reason: 'unknown chat', missing: true };
  const messages = listMessages(thread.id);
  const card = messages.find((m) => m.kind === 'version' && m.versionId === versionId);
  if (!card) return { reason: NOT_IN_CHAT, missing: true };
  const n = (card.body as VersionCardBody | null)?.number ?? 0;
  if (messages.some((m) => m.kind === 'edit' && live(m.jobId))) return { reason: APPLY_RUNNING };
  if (!spliced(versionId)) return { reason: notSpliced(n) };
  const status = await deps.status(thread.songId);
  const src = status.source;
  if (src?.activeVersionId !== versionId) return { reason: notActive(n) };
  const read = status.read;
  const facts = (read?.ok ? read.facts : null) as ScoreFacts | null;
  const e = status.eligibility;
  if (e.state !== 'eligible' || !read || !facts || !src.abc) {
    return { reason: `its score cannot be re-rendered: ${'reason' in e ? e.reason : read?.error ?? 'the score could not be read'}` };
  }
  const limit = limitReasons({ seconds: read.seconds, bpm: read.bpm, tokens: read.tokens, changed: { abc: true, style: true } }).find((r) => r !== NO_CHANGE);
  if (limit) return { reason: limit };
  const applied: ApplyResult = {
    ok: true, abc: src.abc, style: src.style ?? '', lyrics: src.lyrics, verdicts: [], checks: { ok: true, problems: [], differences: [] },
    changed: { abc: false, style: false, lyrics: false }, sections: null, chords_present: read.chordsPresent, bpm: read.bpm, seconds: read.seconds, tokens: read.tokens,
  };
  const plan = buildPlan({
    id: crypto.randomUUID(), createdAt: Date.now(), songId: thread.songId, source: { fingerprint: src.fingerprint, activeVersionId: versionId },
    request: 'RE-RENDER WHOLE SONG', facts, chordsPresent: read.chordsPresent, ops: [], applied, attempts: 1, refusals: [],
  });
  const body: EditBody = {
    planId: plan.id, ops: [], verdicts: [], checks: plan.checks, splice: { splice: false, reason: WHOLE_REASON }, renderMode: plan.renderMode,
    assumptions: [], attempts: plan.attempts, refusals: [], from: { bpm: facts.header.bpm, key: facts.header.key },
  };
  const proposalId = crypto.randomUUID();
  const { message } = appendMessage(thread.id, { role: 'assistant', kind: 'edit', text: cardText(n), body, proposalId });
  setPlan(plan); // replaces the song's pending plan (D-028), as an edit turn's card does
  propose({ id: proposalId, threadId: thread.id, messageId: message.id, createdAt: Date.now(), kind: 'edit', planId: plan.id });
  return { messageId: message.id, proposalId };
}
