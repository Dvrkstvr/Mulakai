/**
 * Gathers what a turn's song-state block needs (songState.ts): library titles, and for a song thread
 * its title, base versions with labels and yue-server's read of the active score (scoreStatus: the
 * sidecar + `/v1/scores/read`), or why the score cannot be read. The draft thread needs only the
 * library; its draft's fields go in as the pending proposal (songState.draftLines). C3: the thread's
 * references add an `ATTACHED:` line each until read, and the reading a recipe builds on (the follow-up's,
 * else the latest) its REFERENCE block (referenceTurn); `analyzeFor` resolves an analyze reply's target.
 */
import { db } from '../../db/index.js';
import { scoreStatus, type ScoreStatus } from '../score/scoreStatus.js';
import type { ScoreFacts } from '../score/planTypes.js';
import { LIBRARY_MAX, songStateLines, type SongInput, type VersionLine } from './songState.js';
import type { TurnState } from './turnActions.js';
import { listReferences, type Reference } from './referenceStore.js';
import { resolveReference, type LibrarySong } from './referenceResolve.js';
import { analyzeBody, attachedLine, referenceBlock } from './referenceTurn.js';
import type { AnalyzeResolved } from './turnDispatch.js';
import type { Reading, ReadingPlanSources } from './reading.js';
import type { AnalyzeTarget, ChatThread, DraftFields, EditBase } from './chatTypes.js';
import { rangeOutside, resolveRange } from '../score/planReferent.js';
import { isRead } from './reading.js';
import { playableVersion, readingChain, readVersionAnalysis, wordTimings } from './analysisStore.js';
import { isFailed, type RangeMark, type RangeResolution } from './analysisTypes.js';
import { markBlock, type MarkBlock } from './markBlock.js';
import { markBars } from './markFit.js';
import type { EditMark } from './turnDispatch.js';

export interface SourceDeps { status: (songId: string) => Promise<ScoreStatus> }
export const sourceDeps = (over: Partial<SourceDeps> = {}): SourceDeps => ({ status: (songId) => scoreStatus(songId), ...over });

export interface GatheredState {
  block: string[];
  facts: ScoreFacts | null;
  /** The draft thread's fields (the pending card with the person's hand edits); null on a song thread. */
  draft: DraftFields | null;
  state: TurnState;
  /** Why the song's score cannot be read; null on the draft thread or when it was read. */
  scoreReason: string | null;
  /** C3: the thread's references, the library (for an analyze reply) and the reading a recipe builds on. */
  refs: TurnRefs;
  /** C0b: what an edit turn plans on (an eligible song), or why it cannot be edited; null on the draft thread. */
  edit: EditBase | { reason: string } | null;
  /** C1: the user message's mark resolved at the turn's start; null without one. */
  mark: TurnMark | null;
}
export interface TurnRefs {
  references: Reference[];
  library: LibrarySong[];
  /** The user message's attach, or null. */
  attach: string | null;
  /** Null on a song thread (a recipe there is a NEW CHAT redirect) and before any reading. */
  reading: { id: string; reading: Reading } | null;
}
/** C3: this message's attach; `followUp`: the reference whose reading queued this turn (D-129). C1: the mark SEND
 * carried, resolved again here (it may have gone stale while the turn queued behind an APPLY, D-175). */
export interface GatherOptions { attach?: string | null; followUp?: string | null; mark?: RangeMark | null }

/** A mark resolved now against the playable version (D-175): pinned with its MARK block, or stale. */
export type MarkAt = { ok: true; mark: RangeMark; block: MarkBlock; outside: string | null }
  | { ok: false; stale: Extract<RangeResolution, { pinned: false }> };
/** The turn's mark: stale, or its lines and bars clamped to the score the edit plans on, for the schema and card. */
export type TurnMark = { stale: string } | { lines: string[]; range: [number, number] | null; edit: EditMark };

export function markAt(songId: string, mark: RangeMark): MarkAt {
  const playable = playableVersion(songId);
  if (!playable) return { ok: false, stale: { pinned: false, was: mark, shift: null, reason: 'this song has no version to mark' } };
  const analysis = readVersionAnalysis(playable.id);
  const done = analysis && !isFailed(analysis) ? analysis : null;
  const parent = readingChain(playable.id).parent;
  const number = (id: string) => baseVersions(songId).find((v) => v.id === id)?.number ?? null;
  const bars = done && isRead(done.bars) ? { starts: done.bars.starts, end: done.bars.end } : null;
  const r = resolveRange(mark, { playable, parent: parent && { ...parent, number: number(parent.versionId) }, bars });
  if (!r.pinned) return { ok: false, stale: r };
  const block = markBlock({ mark: r.mark, number: playable.number, analysis: done, words: wordTimings(playable.id) });
  return { ok: true, mark: r.mark, block, outside: rangeOutside(r.mark, bars) };
}

function turnMark(songId: string, mark: RangeMark, facts: ScoreFacts | null): TurnMark {
  const at = markAt(songId, mark);
  if (!at.ok) return { stale: at.stale.reason };
  const { bars } = at.block;
  const clamp = bars && facts ? markBars(bars, facts.header.bars) : { range: bars, notes: [] };
  return { lines: at.block.lines, range: clamp.range, edit: { versionId: at.mark.versionId, bars: clamp.range, seconds: at.mark.seconds, notes: clamp.notes } };
}

export const librarySongs = (): LibrarySong[] =>
  db.prepare(`SELECT id, title FROM songs WHERE trashed_at IS NULL ORDER BY created_at DESC LIMIT ?`).all(LIBRARY_MAX) as LibrarySong[];

/** The ATTACHED lines and the REFERENCE block; the reading is the follow-up's, else the latest one. */
function referenceState(thread: ChatThread, library: LibrarySong[], opts: GatherOptions): { lines: string[]; refs: TurnRefs } {
  const references = listReferences(thread.id);
  const read = references.filter((r) => r.reading);
  const latest = read.reduce<Reference | undefined>((a, r) => (!a || r.reading!.readAt >= a.reading!.readAt ? r : a), undefined);
  const pick = (opts.followUp ? read.find((r) => r.id === opts.followUp) : undefined) ?? latest;
  const lines = references.filter((r) => !r.reading).map(attachedLine);
  if (pick) lines.push(...referenceBlock(pick.name, pick.reading!));
  const reading = pick && !thread.songId ? { id: pick.id, reading: pick.reading! } : null;
  return { lines, refs: { references, library, attach: opts.attach ?? null, reading } };
}

/** An analyze reply's target -> the READ card's body, or why it cannot be read (referenceResolve). */
export function analyzeFor(named: string, refs: TurnRefs, plan: (target: AnalyzeTarget) => ReadingPlanSources): AnalyzeResolved {
  const target = resolveReference({ named, attach: refs.attach, references: refs.references, library: refs.library });
  if ('reason' in target) return { reason: target.reason, attached: refs.references.map((r) => r.name) };
  const ref = 'referenceId' in target ? refs.references.find((r) => r.id === target.referenceId) : undefined;
  const song = 'songId' in target
    ? db.prepare(`SELECT title, duration FROM songs WHERE id = ?`).get(target.songId) as { title: string; duration: number | null } | undefined
    : undefined;
  const info = ref ? { name: ref.name, seconds: ref.seconds } : { name: song?.title ?? named, seconds: song?.duration ?? null };
  return { body: analyzeBody(target, info, plan(target)) };
}

/** The base layer's versions in the order they were made, numbered from 1. */
export function baseVersions(songId: string): Array<VersionLine & { id: string }> {
  const rows = db.prepare(`SELECT v.id, v.label, v.active FROM versions v JOIN layers l ON l.id = v.layer_id
    WHERE l.song_id = ? AND l.kind = 'base' ORDER BY v.created_at, v.rowid`).all(songId) as Array<{ id: string; label: string; active: number }>;
  return rows.map((r, i) => ({ id: r.id, number: i + 1, label: r.label || (i === 0 ? 'first take' : 'version'), active: r.active === 1 }));
}

function unreadable(s: ScoreStatus): string {
  const e = s.eligibility;
  if ('reason' in e) return e.reason;
  if (e.state === 'hidden') return 'this song was not made by YuE2 or SCORE is not set up, so there is no score to read';
  return s.read?.error ?? 'yue-server did not return the score facts';
}

/** An eligible song's score and source for the plan (planJob's own conditions), else null. */
function editBase(songId: string, status: ScoreStatus | null, facts: ScoreFacts | null): EditBase | null {
  const src = status?.source;
  if (status?.eligibility.state !== 'eligible' || !facts || !src?.abc || !src.activeVersionId) return null;
  return {
    songId, facts, chordsPresent: status.read?.chordsPresent ?? null,
    source: { abc: src.abc, style: src.style ?? '', lyrics: src.lyrics, activeVersionId: src.activeVersionId, fingerprint: src.fingerprint },
  };
}

export async function gatherTurnState(thread: ChatThread, deps: SourceDeps = sourceDeps(), opts: GatherOptions = {}): Promise<GatheredState> {
  const songs = librarySongs();
  const library = songs.map((s) => s.title);
  const { lines, refs } = referenceState(thread, songs, opts);
  const flags = { attached: refs.references.some((r) => !r.reading), referenceRead: Boolean(refs.reading), followUp: Boolean(opts.followUp) };
  const c3 = Object.fromEntries(Object.entries(flags).filter(([, on]) => on)); // only what is set: a C0 state stays as it was
  if (!thread.songId) {
    const block = [...songStateLines({ library, song: null }), ...lines];
    return { block, facts: null, draft: thread.draft.fields, state: { hasSong: false, scoreReadable: false, ...c3 }, scoreReason: null, refs, edit: null, mark: null };
  }
  const row = db.prepare(`SELECT title, caption FROM songs WHERE id = ?`).get(thread.songId) as { title: string; caption: string } | undefined;
  let status: ScoreStatus | null = null;
  let reason: string | null = null;
  try {
    status = await deps.status(thread.songId);
  } catch (err) {
    reason = err instanceof Error ? err.message : String(err);
  }
  const facts = (status?.read?.ok && status.read.facts ? status.read.facts : null) as ScoreFacts | null;
  if (!facts && status) reason = unreadable(status);
  const song: SongInput = {
    title: row?.title ?? 'Untitled', style: status?.source?.style ?? row?.caption ?? '',
    versions: baseVersions(thread.songId), facts, reason: facts ? null : reason,
  };
  const block = [...songStateLines({ library, song }), ...lines];
  const edit = editBase(thread.songId, status, facts) ?? { reason: (status ? unreadable(status) : reason) ?? 'its score could not be read' };
  const mark = opts.mark ? turnMark(thread.songId, opts.mark, facts) : null;
  return { block, facts, draft: null, state: { hasSong: true, scoreReadable: Boolean(facts), ...c3 }, scoreReason: song.reason, refs, edit, mark };
}
