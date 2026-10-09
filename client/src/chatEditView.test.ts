/** What the CHAT screen shows for edit and version cards (CB-5): the card's state with APPLY over it, the strip's
 * bar count, ASK AGAIN's text, the song's version numbers and the A/B against the version before (F-048). */
import { describe, expect, it } from 'vitest';
import type { ChatMessageView, ChatThreadView } from './api/chat';
import type { ChatEditBody, ChatSpliceStep } from './api/chatEdit';
import type { SongDetail } from './api';
import { abPrevious } from './chatAb';
import { askAgainText, songVersions, stripTotal } from './chatEditView';
import { cardView, committing } from './chatScreen';
import type { CommitState } from './chatTurn';

const msg = (over: Partial<ChatMessageView>): ChatMessageView => ({
  id: 'e', seq: 1, role: 'assistant', kind: 'edit', text: '', body: null, proposalId: 'e1', jobId: null, versionId: null, state: 'pending', createdAt: '', ...over,
});
const apply = (phase: CommitState['phase']): CommitState => ({ proposalId: 'e1', jobId: 'r1', apply: true, phase });
const edit = (splice: ChatEditBody['splice'], bars = 76) => ({ splice, checks: { bars } }) as ChatEditBody;
const v = (id: string, active: 0 | 1, audio_file = `${id}.wav`) => ({ id, active, audio_file });
const song = (versions: Array<ReturnType<typeof v>>) => ({ layers: [{ kind: 'base', versions }] }) as unknown as SongDetail;

describe('cardView for an edit card', () => {
  it('STALE carries the server reason; done wins over this tab\'s commit', () => {
    expect(cardView(msg({ state: 'stale', body: { stale: 'this song changed since the proposal' } as never }), null))
      .toEqual({ kind: 'stale', reason: 'this song changed since the proposal' });
    expect(cardView(msg({ state: 'done' }), apply({ kind: 'failed', error: 'x' }))).toEqual({ kind: 'done' });
  });
  it('a cancelled APPLY returns the card to pending, saying where it stopped (F-049 #1)', () => {
    expect(cardView(msg({}), apply({ kind: 'cancelled', during: 'splicing' }))).toEqual({ kind: 'pending', error: null, cancelled: 'splicing' });
  });
  it("this tab's failure does not mask a card the server moved on (superseded)", () => {
    expect(cardView(msg({ state: 'superseded' }), apply({ kind: 'failed', error: 'x' })).kind).toBe('superseded');
  });
  it('an edit committing makes the composer wait', () => {
    const t = { id: 't', songId: 's', messages: [msg({ state: 'committing' })] } as unknown as ChatThreadView;
    expect(committing(t, null)).toBe(true);
  });
});

describe('the edit card helpers', () => {
  it('the strip counts the song as read: a CUT adds its bars back, a REPEAT takes its copy out', () => {
    expect(stripTotal(edit({ splice: true, kind: 'reharmonize', from_bar: 25, to_bar: 32 }))).toBe(76);
    expect(stripTotal(edit({ splice: true, kind: 'cut', from_bar: 57, to_bar: 64 }, 68))).toBe(76);
    expect(stripTotal(edit({ splice: true, kind: 'repeat', from_bar: 17, to_bar: 24 }, 84))).toBe(76);
    expect(stripTotal(edit({ splice: false, reason: 'x' }))).toBe(76);
    // C4: a chain adds back every cut and takes out every copy; re-sung spans keep their length.
    const steps: ChatSpliceStep[] = [{ kind: 'repeat', from_bar: 49, to_bar: 56, ops: [2] }, { kind: 'cut', from_bar: 17, to_bar: 24, ops: [1] }, { kind: 'reharmonize', from_bar: 3, to_bar: 6, ops: [0] }];
    expect(stripTotal(edit({ splice: true, kind: 'several', from_bar: 3, to_bar: 56, steps }, 76))).toBe(76);
    expect(stripTotal(edit({ splice: true, kind: 'several', from_bar: 3, to_bar: 24, steps: steps.slice(1) }, 68))).toBe(76);
  });
  it('ASK AGAIN re-asks the message the card answered', () => {
    const msgs = [msg({ id: 'u1', role: 'user', kind: 'text', text: 'jazz chords' }), msg({ id: 'e' }), msg({ id: 'u2', role: 'user', kind: 'text', text: 'later' })];
    expect(askAgainText(msgs, 'e')).toBe('jazz chords');
    expect(askAgainText(msgs.slice(1), 'e')).toBeNull();
  });
  it("the song's version numbers: the active one and the next", () => {
    // GET /api/songs/:id lists versions newest first.
    expect(songVersions(song([v('b', 1), v('a', 0)]))).toEqual({ active: 2, activeId: 'b', next: 3 });
    expect(songVersions(song([v('b', 0), v('a', 1)]))).toEqual({ active: 1, activeId: 'a', next: 3 });
    expect(songVersions(null)).toEqual({ active: null, activeId: null, next: 2 });
  });
});

describe('abPrevious (F-048 #2, edge)', () => {
  const card = (over: Partial<ChatMessageView> = {}) => msg({
    kind: 'version', versionId: 'b', body: { previous: { versionId: 'a', number: 1 }, number: 2 } as never, ...over,
  });
  it('the newest version card, while it is the active take, A/Bs against the version before it', () => {
    expect(abPrevious(card(), song([v('a', 0), v('b', 1)]))).toEqual({ versionId: 'a', number: 1, current: 2, url: '/audio/a.wav' });
  });
  it('none once another version is active, the previous one is gone, or the card has none', () => {
    expect(abPrevious(card(), song([v('a', 1), v('b', 0)]))).toBeNull();
    expect(abPrevious(card(), song([v('b', 1)]))).toBeNull();
    expect(abPrevious(card({ body: { previous: null, number: 2 } as never }), song([v('a', 0), v('b', 1)]))).toBeNull();
    expect(abPrevious(null, song([v('b', 1)]))).toBeNull();
  });
});
