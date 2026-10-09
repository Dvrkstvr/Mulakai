/** The C2 edit card's words as chat-converge.html draws them (3a-3b, 4a-4d; D-229). */
import { describe, expect, it } from 'vitest';
import type { ChatSplice } from './api/chatEdit';
import type { ScoreOp } from './api/score';
import { cardTitle, chatRemovedLine, chatSinceLine, mapCaption } from './chatReviseCopy';

const REHARM: ChatSplice = { splice: true, kind: 'reharmonize', from_bar: 49, to_bar: 56 };
const CUT: ChatSplice = { splice: true, kind: 'cut', from_bar: 73, to_bar: 80 };
const WHOLE: ChatSplice = { splice: false, reason: 'the plan makes 2 changes' };
const RE: ScoreOp = { op: 'REHARMONIZE', from_bar: 49, to_bar: 56, chords: [] };
const TEMPO: ScoreOp = { op: 'SET_TEMPO', bpm: 92 };
const CUT_OP: ScoreOp = { op: 'CUT', section: 9, label: 'outro' };
const LYR: ScoreOp = { op: 'REWRITE_LYRICS', block: 5, tag: '[Chorus]', occurrence: 2, lines: [] };
const SEC = [{ label: 'verse', occurrence: 1, from: 1, to: 40 }, { label: 'chorus', occurrence: 1, from: 41, to: 48 }, { label: 'outro', occurrence: 1, from: 73, to: 80 }];
const map = (ops: Array<{ spans: Array<[number, number]>; whole: boolean }>) => ({ bars: 80, sections: SEC, ops });

describe('header, SINCE and REMOVED (3a, 3b)', () => {
  it('the plan title is the header; the superseded card says REVISED BELOW', () => {
    expect(cardTitle(undefined, 1, 4)).toBe('PLAN · 1 CHANGE · AGAINST BASE v4');
    expect(cardTitle(2, 2, 4)).toBe('PLAN 2 · REVISED FROM PLAN 1 · 2 CHANGES · AGAINST BASE v4');
    expect(cardTitle(1, 1, 4, true)).toBe('PLAN 1 · REVISED BELOW');
  });
  it('SINCE leaves zero marks out and always says REMOVED; REMOVED (n) lists the ops', () => {
    expect(chatSinceLine({ planId: 'p1', marks: [{ mark: 'SAME', was: RE }, { mark: 'NEW', was: null }], removed: [] }, 2)).toBe('SINCE PLAN 1 · 1 NEW · 1 SAME · 0 REMOVED');
    expect(chatSinceLine({ planId: 'p1', marks: [{ mark: 'CHANGED', was: RE }, { mark: 'SAME', was: TEMPO }], removed: [TEMPO] }, 2)).toBe('SINCE PLAN 1 · 1 CHANGED · 1 SAME · 1 REMOVED');
    expect(chatRemovedLine([{ name: 'WRITE PHRASE', detail: 'bars 41–44 · lead line in the chorus' }])).toBe('REMOVED (1) · WRITE PHRASE bars 41–44 · lead line in the chorus');
    expect(chatRemovedLine([])).toBeNull();
  });
});

describe('the bar map caption (4a-4d)', () => {
  it('a splice: the bars that change against the ones that stay', () => {
    expect(mapCaption(map([{ spans: [[49, 56]], whole: false }]), [RE], null, REHARM, 4)).toBe('8 OF 80 BARS CHANGE · THE OTHER 72 ARE v4');
  });
  it('a whole-song op: ALL BARS CHANGE (TEMPO), then what the edited span is', () => {
    expect(mapCaption(map([{ spans: [[49, 56]], whole: false }, { spans: [], whole: true }]), [RE, TEMPO], null, WHOLE, 4))
      .toBe('ALL 80 BARS CHANGE (TEMPO) · BARS 49–56 ARE THE NEW HARMONY');
  });
  it('a lyric rewrite: WORDS CHANGE IN, the whole song re-renders', () => {
    expect(mapCaption(map([{ spans: [[41, 48]], whole: false }]), [LYR], null, WHOLE, 4)).toBe('WORDS CHANGE IN BARS 41–48 · THE WHOLE SONG RE-RENDERS');
  });
  it('a CUT names its section and S-number', () => {
    expect(mapCaption(map([{ spans: [[73, 80]], whole: false }]), [CUT_OP], null, CUT, 4)).toBe('OUTRO S9 CUT · 8 BARS REMOVED · SEAM UN-TIED');
    // C4 (D-265): two REHARMONIZE ops 1 bar apart merge into one step that re-sings the gap bar too; never "undefined".
    const merged: ChatSplice = { splice: true, kind: 'several', from_bar: 41, to_bar: 80, steps: [
      { kind: 'cut', from_bar: 73, to_bar: 80, ops: [2] }, { kind: 'reharmonize', from_bar: 41, to_bar: 52, ops: [0, 1] }] };
    const re2: ScoreOp = { op: 'REHARMONIZE', from_bar: 47, to_bar: 52, chords: [] };
    expect(mapCaption(map([{ spans: [[41, 45]], whole: false }, { spans: [[47, 52]], whole: false }, { spans: [[73, 80]], whole: false }]), [RE, re2, CUT_OP], null, merged, 4))
      .toBe('20 OF 80 BARS CHANGE · THE OTHER 60 ARE v4');
  });
  it('one REHARMONIZE span merged from 2 ops (D-271 b revised): the gap bar between them counts as changed, as the strip says', () => {
    const one: ChatSplice = { splice: true, kind: 'reharmonize', from_bar: 41, to_bar: 52 };
    const re2: ScoreOp = { op: 'REHARMONIZE', from_bar: 47, to_bar: 52, chords: [] };
    expect(mapCaption(map([{ spans: [[41, 45]], whole: false }, { spans: [[47, 52]], whole: false }]), [RE, re2], null, one, 4))
      .toBe('12 OF 80 BARS CHANGE · THE OTHER 68 ARE v4');
  });
  it('several ops rendering the whole song never claim the other bars stay; shared bars count once', () => {
    expect(mapCaption(map([{ spans: [[49, 56]], whole: false }, { spans: [[53, 60]], whole: false }]), [RE, RE], null, WHOLE, 4))
      .toBe('12 OF 80 BARS CHANGE · THE WHOLE SONG RE-RENDERS');
  });
  it('a hovered row names its bars and op, LIT', () => {
    const m = map([{ spans: [[49, 56]], whole: false }, { spans: [], whole: true }]);
    expect(mapCaption(m, [RE, TEMPO], 0, WHOLE, 4)).toBe('BARS 49–56 · REHARMONIZE · LIT');
    expect(mapCaption(m, [RE, TEMPO], 1, WHOLE, 4)).toBe('WHOLE SONG · SET TEMPO · LIT');
  });
});
