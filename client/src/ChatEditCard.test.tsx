/** The edit card, one state each (chat-edit.html 1a-1d, 2b, 4b-4d; EC-1..EC-4, EC-8; F-046, F-049 #1 and edge). */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { ChatMessageView } from './api/chat';
import type { ChatEditBody } from './api/chatEdit';
import { ChatEditCard } from './ChatEditCard';
import type { CardView } from './chatScreen';

const body = (over: Partial<ChatEditBody> = {}): ChatEditBody => ({
  chat_v: 1, planId: 'plan1',
  ops: [{ op: 'REHARMONIZE', from_bar: 25, to_bar: 32, chords: [{ bar: 25, beat: 1, root: 'D', quality: 'm7' }] }],
  verdicts: [{ index: 0, op: 'REHARMONIZE', ok: true, reason: null }],
  checks: { bars: 76, seconds: 192, tokens: 9000, chordsPresent: true, changed: { abc: true, style: false } },
  splice: { splice: true, kind: 'reharmonize', from_bar: 25, to_bar: 32 }, renderMode: { cot: 'full', reason: 'chords' },
  assumptions: ['Assuming chorus 1, bars 25-32 (the song has 3 choruses)'], attempts: 1, refusals: [], ...over,
});
const msg = (b: ChatEditBody = body()): ChatMessageView => ({
  id: 'e', seq: 3, role: 'assistant', kind: 'edit', text: 'Re-harmonizing…', body: b as never, proposalId: 'e1', jobId: null, versionId: null, state: 'pending', createdAt: '',
});
const html = (view: CardView, b?: ChatEditBody, ahead = 0) => renderToStaticMarkup(
  <ChatEditCard message={msg(b)} view={view} base={1} next={2} ahead={ahead} canAsk onApply={vi.fn()} onCancel={vi.fn()} onAskAgain={vi.fn()} />,
);
const PENDING: CardView = { kind: 'pending', error: null };

describe('ChatEditCard', () => {
  it('pending splice: the assumption, the change list, the sky strip over bars 25-32, the splice clause and APPLY (acid)', () => {
    const out = html(PENDING);
    expect(out).toContain('EDIT · SCORE');
    expect(out).toContain('Assuming chorus 1, bars 25-32');
    expect(out).toContain('REHARMONIZE');
    expect(out).toContain('BARS 25-32 CHANGE · THE OTHER 68 ARE v1');
    expect(out).toMatch(/class="chat-strip-bar"><i style="left:31\.5\d*%;width:10\.5\d*%"/);
    expect(out).toContain("every other bar stays v1&#x27;s audio");
    expect(out).toMatch(/<button type="button" class="acid chat-create"><span>APPLY/);
  });

  it('pending whole song: the full hatch, the reason, the whole-song clause', () => {
    const out = html(PENDING, body({ splice: { splice: false, reason: 'the plan makes 2 changes; only a single change can be spliced' } }));
    expect(out).toContain('chat-strip-bar all');
    expect(out).toContain('ALL 76 BARS CHANGE');
    expect(out).toContain('WHY THE WHOLE SONG: the plan makes 2 changes');
    expect(out).toContain('the whole song is re-rendered');
  });

  it('committing: the steps, the phase line with CANCEL, APPLY off with its label kept', () => {
    const out = html({ kind: 'committing', phase: { kind: 'running', progressText: 'splicing', stage: null, progress: null } });
    expect(out).toContain('EDIT · SCORE · APPLYING');
    expect(out).toContain('v1 is untouched until v2 is saved');
    expect(out).toMatch(/<i class="dn">RENDERING<\/i><i class="on">SPLICING<\/i><i class="">SAVING<\/i>/);
    expect(out).toContain('SPLICING · bars 25-32 into the old take');
    expect(out).toMatch(/class="chat-q"><span>CANCEL/);
    expect(out).toMatch(/class="acid chat-create" disabled=""><span>APPLY/);
  });

  it('saving: CANCEL is off', () => {
    expect(html({ kind: 'committing', phase: { kind: 'running', progressText: 'saving' } })).toMatch(/class="chat-q" disabled=""><span>CANCEL/);
  });

  it('cancelled or failed: back to pending, saying nothing was saved, APPLY live again', () => {
    expect(html({ kind: 'pending', error: null, cancelled: 'rendering' })).toContain('CANCELLED WHILE RENDERING');
    const failed = html({ kind: 'pending', error: 'YuE2 ran out of memory' });
    expect(failed).toContain('APPLY FAILED');
    expect(failed).toContain('Nothing was saved, v1 is untouched.');
    expect(failed).toMatch(/class="acid chat-create"><span>APPLY/);
  });

  it('stale: no APPLY, the reason and ASK AGAIN (F-049 edge)', () => {
    const out = html({ kind: 'stale', reason: 'this song changed since the proposal' });
    expect(out).toContain('THIS SONG CHANGED SINCE THE PROPOSAL');
    expect(out).toContain('ASK AGAIN');
    expect(out).not.toContain('chat-create');
  });

  it('superseded dims with no APPLY; expired says so with ASK AGAIN; done folds to one line', () => {
    const sup = html({ kind: 'superseded' });
    expect(sup).toContain('chat-card chat-edit sup');
    expect(sup).toContain('REPLACED BY A NEWER PLAN');
    expect(sup).not.toContain('chat-create');
    expect(html({ kind: 'expired' })).toContain('THIS EDIT EXPIRED');
    expect(html({ kind: 'done' })).toContain('DONE · BARS 25-32');
    expect(html({ kind: 'done' })).not.toContain('REHARMONIZE');
  });
});
