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
const html = (view: CardView, b?: ChatEditBody, ahead = 0, known: { revising?: boolean; revisedBelow?: boolean } = {}) => renderToStaticMarkup(
  <ChatEditCard message={msg(b)} view={view} base={1} next={2} ahead={ahead} canAsk onApply={vi.fn()} onCancel={vi.fn()} onAskAgain={vi.fn()} {...known} />,
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

  it('SET TEMPO names the tempo the plan was read at, like the SCORE dock (87 → 88); an older card without it reads ?', () => {
    const tempo = { ops: [{ op: 'SET_TEMPO' as const, bpm: 88 }], verdicts: [{ index: 0, op: 'SET_TEMPO' as const, ok: true, reason: null }] };
    expect(html(PENDING, body({ ...tempo, from: { bpm: 87, key: 'Am' } }))).toContain('87 → 88 BPM');
    expect(html(PENDING, body(tempo))).toContain('? → 88 BPM');
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
    const cut = html({ kind: 'interrupted' }); // F-049 #3: a restart cut APPLY
    expect(cut).toContain('EDIT · SCORE · INTERRUPTED');
    expect(cut).toContain('The server restarted while APPLY ran. Nothing was saved, v1 is untouched');
    expect(cut).toContain('ASK AGAIN');
    expect(cut).not.toContain('chat-create');
    expect(html({ kind: 'done' })).toContain('DONE · BARS 25-32');
    expect(html({ kind: 'done' })).not.toContain('REHARMONIZE');
  });
});

describe('ChatEditCard, C2: revised, superseded by a revise, the bar map (F-058, F-060, D-229)', () => {
  const REHARM = body().ops[0];
  const TEMPO = { op: 'SET_TEMPO' as const, bpm: 92 };
  const map = { bars: 80, sections: [{ label: 'chorus', occurrence: 1, from: 41, to: 56 }], ops: [{ spans: [[49, 56]] as Array<[number, number]>, whole: false }, { spans: [], whole: true }] };
  const plan2 = body({
    planId: 'plan2', revision: 2, ops: [REHARM, TEMPO],
    verdicts: [{ index: 0, op: 'REHARMONIZE', ok: true, reason: null }, { index: 1, op: 'SET_TEMPO', ok: true, reason: null }],
    since: { planId: 'plan1', marks: [{ mark: 'SAME', was: REHARM }, { mark: 'NEW', was: null }], removed: [{ op: 'WRITE_PHRASE', start_bar: 41, instrument: 'lead', bars: [] }] },
    splice: { splice: false, reason: 'the plan makes 2 changes' }, map,
  });

  it('a revised card: the plan title as its header, the SINCE line, NEW / SAME marks, REMOVED (n), the bar map instead of the strip', () => {
    const out = html(PENDING, plan2);
    expect(out).toContain('<span class="chat-lb">PLAN 2 · REVISED FROM PLAN 1 · 2 CHANGES · AGAINST BASE v1</span><span class="chat-hn">EDIT · SCORE · nothing runs yet</span>');
    expect(out).not.toContain('score-plan-label'); // the title is the header, not repeated in the list
    expect(out).toContain('SINCE PLAN 1 · 1 NEW · 1 SAME · 1 REMOVED');
    expect(out).toMatch(/score-op-mark">SAME<.*score-op-mark hi">NEW</);
    expect(out).toContain('REMOVED (1) · WRITE PHRASE');
    expect(out).toContain('aria-label="Bar map"');
    expect(out).not.toContain('chat-strip-bar');
    expect(out).toContain('ALL 80 BARS CHANGE (TEMPO) · BARS 49–56 ARE THE NEW HARMONY');
    expect(out).toMatch(/class="score-op" tabindex="0"/); // a row is focusable: it lights its bars (Q-143)
    expect(out).toMatch(/class="acid chat-create"><span>APPLY/);
  });

  it('the card a revise superseded stays in full, dimmed: REVISED BELOW, its map, no APPLY (Q-140 A)', () => {
    const out = html({ kind: 'superseded' }, body({ map: { bars: 80, sections: [], ops: [{ spans: [[25, 32]], whole: false }] } }), 0, { revisedBelow: true });
    expect(out).toContain('chat-card chat-edit sup');
    expect(out).toContain('<span class="chat-lb">PLAN 1 · REVISED BELOW</span><span class="chat-hn">EDIT · SCORE · superseded</span>');
    expect(out).toContain('Revised below. This one cannot be applied.');
    expect(out).toContain('aria-label="Bar map"');
    expect(out).not.toContain('chat-create');
    expect(html({ kind: 'superseded' })).toContain('A newer edit card is below.'); // a fresh plan, not a revise
  });

  it('APPLY is off while a turn (a revise) runs, back on when it ends (Q-144)', () => {
    expect(html(PENDING, undefined, 0, { revising: true })).toMatch(/class="acid chat-create" disabled="" title="off while a reply is open"><span>APPLY/);
    expect(html(PENDING, undefined, 0, { revising: false })).toMatch(/class="acid chat-create"><span>APPLY/);
  });

  it('a card from before C2 (no map) keeps the strip, and its rows are not focusable', () => {
    const out = html(PENDING);
    expect(out).toContain('chat-strip-bar');
    expect(out).not.toContain('tabindex');
  });
});
