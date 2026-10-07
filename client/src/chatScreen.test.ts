import { describe, expect, it } from 'vitest';
import type { ChatDraftFields, ChatMessageView, ChatThreadView } from './api/chat';
import { SIDEBAR_FOOT, cardHeader, songSubtitle, thinkingTail, touchedSinceSend } from './chatCopy';
import { cardView, editedSinceProposal, fillingKeys, fmtLength, latestSong, playerTake, sidebarFoot, sidebarMode } from './chatScreen';
import { INITIAL_TURN, type CommitState } from './chatTurn';

const msg = (over: Partial<ChatMessageView>): ChatMessageView => ({
  id: 'm', seq: 1, role: 'assistant', kind: 'recipe', text: '', body: null, proposalId: 'p1', jobId: null, versionId: null, state: 'pending', createdAt: '', ...over,
});
const FIELDS: ChatDraftFields = { title: 'Luz', style: null, bpm: 68, key: 'Am', timeSignature: '4/4', language: null, structure: [], lyrics: [], engine: 'yue2' };
const thread = (messages: ChatMessageView[], songId: string | null = null) =>
  ({ id: 't', songId, draft: { draft_v: 1, rev: 1, fields: FIELDS, touched: {} }, blockers: [], messages }) as ChatThreadView;
const take = (phase: CommitState['phase'], proposalId = 'p1'): CommitState => ({ proposalId, jobId: 'j', phase });

describe('cardView', () => {
  it('follows the server state when this tab has no take on the card', () => {
    expect(cardView(msg({ state: 'pending' }), null)).toEqual({ kind: 'pending', error: null });
    expect(cardView(msg({ state: 'superseded' }), null).kind).toBe('superseded');
    expect(cardView(msg({ state: 'expired' }), null).kind).toBe('expired');
    expect(cardView(msg({ state: 'interrupted' }), null).kind).toBe('interrupted'); // an edit card's APPLY a restart cut (F-049 #3)
    expect(cardView(msg({ state: 'done' }), null).kind).toBe('done');
    expect(cardView(msg({ state: 'committing' }), null)).toEqual({ kind: 'committing', phase: null });
  });
  it('a take running from this card: committing with its phase', () => {
    expect(cardView(msg({}), take({ kind: 'running', progressText: 'synthesizing audio 41%' })))
      .toEqual({ kind: 'committing', phase: { kind: 'running', progressText: 'synthesizing audio 41%' } });
  });
  it('a failed take puts the card back to pending with the error', () => {
    expect(cardView(msg({ state: 'committing' }), take({ kind: 'failed', error: 'YuE2 ran out of memory' })))
      .toEqual({ kind: 'pending', error: 'YuE2 ran out of memory' });
  });
  it("another card's take does not touch this one", () => {
    expect(cardView(msg({ state: 'superseded' }), take({ kind: 'queued', ahead: 1 }, 'p2')).kind).toBe('superseded');
  });
});

describe('sidebar', () => {
  it('draft, locked while a take runs (TU-8), the song panel once it is a song (TU-10)', () => {
    expect(sidebarMode(thread([msg({})]), null)).toBe('draft');
    expect(sidebarMode(thread([msg({})]), take({ kind: 'starting' }))).toBe('locked');
    expect(sidebarMode(thread([msg({ state: 'done' })], 'song1'), null)).toBe('song');
  });
  it('the foot points at the card only when a card is live', () => {
    expect(sidebarFoot(thread([]), null, true)).toBe(SIDEBAR_FOOT.empty);
    expect(sidebarFoot(thread([msg({})]), null, true)).toBe(SIDEBAR_FOOT.card);
    expect(sidebarFoot(thread([msg({ state: 'superseded' })]), null, true)).toBe(SIDEBAR_FOOT.empty);
    expect(sidebarFoot(thread([msg({})]), null, false)).toBe(SIDEBAR_FOOT.off);
    expect(sidebarFoot(thread([msg({})]), take({ kind: 'starting' }), true)).toBe(SIDEBAR_FOOT.locked);
  });
  it('a take: the foot names CANCEL only while the card offers it (queued behind another job), never while it renders', () => {
    expect(sidebarFoot(thread([msg({})]), take({ kind: 'queued', ahead: 2 }), true)).toBe(SIDEBAR_FOOT.lockedQueued);
    expect(SIDEBAR_FOOT.lockedQueued).toBe('locked until v1 is saved or you CANCEL');
    for (const phase of [{ kind: 'starting' }, { kind: 'queued', ahead: 0 }, { kind: 'running', progressText: null }] as const) {
      expect(sidebarFoot(thread([msg({})]), take(phase), true)).toBe('locked until v1 is saved');
    }
    // A reload mid-take: the server says committing, this tab has no phase and no CANCEL.
    expect(sidebarFoot(thread([msg({ state: 'committing' })]), null, true)).toBe(SIDEBAR_FOOT.locked);
    expect(SIDEBAR_FOOT.locked).not.toContain('CANCEL');
  });
});

describe('song and fields', () => {
  it('the newest song card is the version shown', () => {
    const song = msg({ kind: 'song', body: { chat_v: 1, seconds: 192, label: 'first take', number: 1 } });
    expect(latestSong(thread([msg({}), song]))?.number).toBe(1);
    expect(latestSong(thread([msg({})]))).toBeNull();
  });
  it('lengths read m:ss', () => {
    expect(fmtLength(192)).toBe('3:12');
    expect(fmtLength(null)).toBeNull();
  });
  it('FILLING… marks the empty fields only while thinking, not the engine', () => {
    expect(fillingKeys(FIELDS, INITIAL_TURN)).toEqual([]);
    expect(fillingKeys(FIELDS, { ...INITIAL_TURN, phase: { kind: 'thinking', attempt: 1, note: null } }))
      .toEqual(['style', 'language', 'structure', 'lyrics']);
    expect(fillingKeys(FIELDS, { ...INITIAL_TURN, cancelling: true, phase: { kind: 'thinking', attempt: 1, note: null } })).toEqual([]);
  });
  it('a hand edit since the proposal is named; fields the recipe lacks are not', () => {
    expect(editedSinceProposal({ bpm: 68, title: 'Luz' }, { ...FIELDS, bpm: 72 })).toEqual(['bpm']);
    expect(editedSinceProposal({ bpm: 68 }, FIELDS)).toEqual([]);
  });
});

describe('screen copy', () => {
  it('the thinking line names the refused attempt in the server words', () => {
    expect(thinkingTail(2, 'bar 5 had 31/32 units')).toBe('· attempt 1 refused: bar 5 had 31/32 units');
    expect(thinkingTail(1, 'unloading')).toBe('· unloading');
    expect(thinkingTail(2, 'unloading the planner')).toBe('· unloading the planner'); // the server's progressText, not a refusal
    expect(thinkingTail(1, null)).toBeNull();
  });
  it('a field touched since SEND is named (frame 6)', () => {
    expect(touchedSinceSend(['bpm'])).toBe('you changed TEMPO since sending · the assistant will skip it and say so');
    expect(touchedSinceSend([])).toBeNull();
  });
  it('title row and card headers', () => {
    expect(songSubtitle(1, '3:12')).toBe('v1 · 3:12 · IN LIBRARY');
    expect(cardHeader('expired')).toBe('PROPOSAL · NEW SONG · EXPIRED');
    expect(cardHeader('done', 'Luz')).toBe('PROPOSAL · NEW SONG · LUZ');
    expect(cardHeader('pending')).toBe('PROPOSAL · NEW SONG');
  });
});

describe('the player take (GET /api/songs/:id carries no audio_file; the take is on the base layer)', () => {
  const v = (audio_file: string, active: 0 | 1) => ({ audio_file, active }) as never;
  const layer = (kind: string, versions: unknown[]) => ({ kind, versions }) as never;
  it("plays the base layer's active version", () => {
    expect(playerTake({ audio_file: null, layers: [layer('base', [v('a.flac', 0), v('b.flac', 1)])] } as never)).toBe('b.flac');
  });
  it('prefers the base layer over an added layer listed first', () => {
    expect(playerTake({ layers: [layer('strings', [v('s.flac', 1)]), layer('base', [v('b.flac', 1)])] } as never)).toBe('b.flac');
  });
  it('has nothing to play without a song or an active take', () => {
    expect(playerTake(null)).toBeNull();
    expect(playerTake({ layers: [layer('base', [v('a.flac', 0)])] } as never)).toBeNull();
    expect(playerTake({ layers: [] } as never)).toBeNull();
  });
});
