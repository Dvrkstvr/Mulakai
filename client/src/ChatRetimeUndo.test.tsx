/** RT-6 (F-094, retime.html D4): a turn that re-timed the reading shows CHANGED · READING · TEMPO, BARS with UNDO TURN,
 * which is the reading's own UNDO; the line follows the reading the player now shows. */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { AnalysisView } from './api/chatAnalysis';
import type { ChatMessageView } from './api/chat';
import type { ChatRetimeDoneBody } from './api/chatRetime';
import { ChatRetimeUndo } from './ChatRetimeUndo';
import { retimeTurnLine } from './chatRetimeTurn';

const done: ChatRetimeDoneBody['retime'] = {
  songId: 's1', versionId: 'v1', number: 1, mode: 'half', bpm: 70, fromBpm: 140, fromBars: 96, toBars: 48, droppedNotes: 0, notes: 100,
  readAt: '2026-10-09T10:00:00.000Z', asReadAt: '2026-10-07T10:00:00.000Z',
};
const say = (body: unknown): ChatMessageView => ({
  id: 'm1', seq: 3, role: 'assistant', kind: 'say', text: 'Re-timed the reading of v1.', proposalId: null, jobId: null, versionId: null,
  state: 'pending', createdAt: '', body: body as ChatMessageView['body'],
});
/** `readAt`: the shown reading's stamp; by default this turn's re-time when re-timed, else the reading as read. */
const view = (retimed: { mode: 'half' | 'double' | 'bpm'; bpm: number } | null, versionId = 'v1', readAt = retimed ? done.readAt : done.asReadAt): AnalysisView => ({
  versionId, shown: { versionId, mode: 'current', readAt,
    retime: { notationId: 'n1', read: { bpm: 140, bars: 96 }, retimed: retimed && { ...retimed, fromBpm: 140, fromBars: 96, toBars: 48, droppedNotes: 0, notes: 100 } } },
} as unknown as AnalysisView);

describe('retimeTurnLine', () => {
  it('offers UNDO TURN while the playing reading is this turn\'s re-time; off while a reply is open', () => {
    expect(retimeTurnLine(done, view({ mode: 'half', bpm: 70 }), false)).toEqual({ kind: 'offer', disabled: false });
    expect(retimeTurnLine(done, view({ mode: 'half', bpm: 70 }), true)).toEqual({ kind: 'offer', disabled: true });
  });
  it('reads UNDONE once the reading is back as read; no link once it was re-timed again or another version plays', () => {
    expect(retimeTurnLine(done, view(null), false)).toEqual({ kind: 'done' });
    expect(retimeTurnLine(done, view({ mode: 'bpm', bpm: 92 }, 'v1', '2026-10-09T11:00:00.000Z'), false)).toEqual({ kind: 'since' });
    expect(retimeTurnLine(done, view({ mode: 'half', bpm: 70 }, 'v2'), false)).toEqual({ kind: 'changed' });
    expect(retimeTurnLine(done, null, false)).toEqual({ kind: 'changed' });
  });
  it('review 3: identity is the re-time\'s readAt, not mode + BPM', () => {
    // (a) undone, then an identical HALF from a later turn: this turn's line no longer offers UNDO
    expect(retimeTurnLine(done, view({ mode: 'half', bpm: 70 }, 'v1', '2026-10-09T11:00:00.000Z'), false)).toEqual({ kind: 'since' });
    // (b) read again (TRANSCRIBE AGAIN): no re-time, but not the reading as read either: not UNDONE
    expect(retimeTurnLine(done, view(null, 'v1', '2026-10-09T12:00:00.000Z'), false)).toEqual({ kind: 'since' });
    expect(retimeTurnLine({ ...done, readAt: undefined } as never, view({ mode: 'half', bpm: 70 }), false)).toEqual({ kind: 'changed' });
  });
});

describe('ChatRetimeUndo', () => {
  const html = (m: ChatMessageView, v: AnalysisView | null, turnOpen = false) =>
    renderToStaticMarkup(<ChatRetimeUndo message={m} view={v} turnOpen={turnOpen} />);
  it('D4: the CHANGED line with UNDO TURN under the reply', () => {
    expect(html(say({ retime: done }), view({ mode: 'half', bpm: 70 })))
      .toBe('<div class="chat-hn chat-changed">CHANGED · READING · TEMPO, BARS<button type="button" class="chat-link chat-undo">UNDO TURN</button></div>');
  });
  it('UNDONE after the reading went back; nothing for a plain say', () => {
    expect(html(say({ retime: done }), view(null))).toBe('<div class="chat-hn chat-changed">UNDONE · the reading is back as read</div>');
    expect(html(say(null), view(null))).toBe('');
  });
  it('the reading changed since (re-read or re-timed again): the CHANGED line says so, no UNDO TURN', () => {
    expect(html(say({ retime: done }), view(null, 'v1', '2026-10-09T12:00:00.000Z')))
      .toBe('<div class="chat-hn chat-changed">CHANGED · READING · TEMPO, BARS · the reading changed since</div>');
  });
});
