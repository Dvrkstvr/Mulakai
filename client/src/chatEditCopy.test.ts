/** The edit and version cards' copy (CB-5, chat-edit.html EC-1..EC-8, F-046 #2, F-048 #1, F-049). */
import { describe, it, expect } from 'vitest';
import type { ChatSplice, ChatVersionBody } from './api/chatEdit';
import type { ScoreOp } from './api/score';
import {
  abListening, abOnLabel, applyFailedBody, applyJobLine, cancelledLine, editConsequence, editDoneLine, staleBody, stripLine,
  mapCaption, versionFoot, versionMeta, versionWarn, waitingFor,
} from './chatEditCopy';

const REHARM: ChatSplice = { splice: true, kind: 'reharmonize', from_bar: 25, to_bar: 32 };
const CUT: ChatSplice = { splice: true, kind: 'cut', from_bar: 57, to_bar: 64 };
const WHOLE: ChatSplice = { splice: false, reason: 'the plan makes 2 changes' };
const CHORDS = { cot: 'full', reason: 'chords' } as const;
const version = (over: Partial<ChatVersionBody> = {}): ChatVersionBody => ({
  chat_v: 1, seconds: 192, label: 'Jazz chords in chorus 1', number: 2, truncated: false, whole: false,
  splice: { kind: 'reharmonize', bars: [25, 32], lengthDiffS: 0.04 }, fallback: null, previous: { versionId: 'v1', number: 1 }, ...over,
});

describe('the edit card', () => {
  it('a splice says only those bars change and the rest is the old take (F-046 #2)', () => {
    const line = editConsequence(REHARM, CHORDS, 1, 2, 0);
    expect(line).toContain('bars 25-32');
    expect(line).toContain("re-sings bars 25-32, instruments there may change, every other bar stays v1's audio");
    expect(line).toContain('saves v2, v1 is kept');
    expect(line).not.toContain('whole song');
  });

  it('any other plan says the whole song is re-rendered and every bar will sound different; a busy GPU queues', () => {
    const line = editConsequence(WHOLE, CHORDS, 1, 2, 2);
    expect(line).toContain('the whole song is re-rendered');
    expect(line).toContain('every bar will sound different, not only the listed ones · instruments may change');
    expect(line).toMatch(/starts after 2 jobs$/);
    expect(editConsequence(WHOLE, { cot: 'melody', reason: 'melody' }, 1, 2, 0)).toContain('renders the melody only');
  });

  it('a CUT says the bars after it are earlier, so BACK TO will not line up (Q-105)', () => {
    expect(editConsequence(CUT, CHORDS, 1, 2, 0)).toContain('bars after the cut are earlier');
  });

  it('C1 N1: a REPEAT / CUT splice says the whole song may be re-rendered if the join cannot be aligned (D-154)', () => {
    const repeat: ChatSplice = { splice: true, kind: 'repeat', from_bar: 56, to_bar: 64 };
    for (const s of [repeat, CUT]) expect(editConsequence(s, CHORDS, 1, 2, 0)).toContain('if the join cannot be aligned, the whole song is re-rendered instead · saves v2, v1 is kept');
  });

  it('the strip line: the span, or all bars', () => {
    expect(stripLine(REHARM, 76, 1)).toBe('BARS 25-32 CHANGE · THE OTHER 68 ARE v1');
    expect(stripLine(CUT, 76, 1)).toBe('BARS 57-64 ARE CUT · THE OTHER 68 ARE v1');
    expect(stripLine(WHOLE, 76, 1)).toBe('ALL 76 BARS CHANGE');
    expect(stripLine({ splice: true, kind: 'reharmonize', from_bar: 43, to_bar: 43 }, 65, 1)).toBe('BAR 43 CHANGES · THE OTHER 64 ARE v1');
    expect(editDoneLine({ splice: true, kind: 'reharmonize', from_bar: 43, to_bar: 43 })).toBe('DONE · BAR 43');
  });

  it('the phase lines: three steps for a splice, two for a whole song, two for a CUT; CANCEL off while saving', () => {
    expect(applyJobLine({ kind: 'running', progressText: 'rendering', stage: null, progress: null }, REHARM, 2))
      .toMatchObject({ title: 'RENDERING · YUE2', tail: 'step 1 of 3', cancel: true });
    expect(applyJobLine({ kind: 'running', progressText: 'rendering', stage: null, progress: null }, WHOLE, 2))
      .toMatchObject({ title: 'RENDERING · WHOLE SONG · YUE2', tail: 'step 1 of 2' });
    expect(applyJobLine({ kind: 'running', progressText: 'splicing' }, REHARM, 2)).toMatchObject({ title: 'SPLICING · bars 25-32 into the old take', tail: 'step 2 of 3' });
    expect(applyJobLine({ kind: 'running', progressText: 'splicing' }, CUT, 2)).toMatchObject({ tail: 'step 1 of 2' });
    expect(applyJobLine({ kind: 'running', progressText: 'saving' }, REHARM, 2)).toMatchObject({ title: 'SAVING · writing v2 and its score', tail: 'step 3 of 3', cancel: false });
    expect(applyJobLine({ kind: 'queued', ahead: 2 }, REHARM, 2)).toMatchObject({ title: 'APPLY · QUEUED · STARTS AFTER 2 JOBS', waiting: true, cancel: true });
    expect(applyJobLine({ kind: 'starting' }, REHARM, 2)).toMatchObject({ title: 'APPLY · STARTING…', waiting: true });
  });

  it('every ending without a version says nothing was saved (EC-8)', () => {
    // Only a cancel while rendering deletes YuE2's render; after a splice it stays until yue-server's sweep (CB-6).
    expect(cancelledLine('rendering', 2)).toBe('CANCELLED WHILE RENDERING · the temporary render is deleted · no v2 saved');
    expect(cancelledLine('splicing', 2)).toBe('CANCELLED WHILE SPLICING · no v2 saved');
    expect(cancelledLine(null, 2)).toBe('CANCELLED · no v2 saved');
    expect(applyFailedBody('YuE2 ran out of memory', 1)).toBe('YuE2 ran out of memory. Nothing was saved, v1 is untouched.');
    expect(staleBody('this song changed since the proposal: a repaint is queued')).toBe('a repaint is queued. Nothing started.');
    expect(staleBody('this song changed since the proposal')).toContain('Nothing started.');
    expect(editDoneLine(REHARM)).toBe('DONE · BARS 25-32');
    expect(editDoneLine(WHOLE)).toBe('DONE · WHOLE SONG');
    expect(waitingFor(2)).toBe('WAITING FOR v2 · a message sent now is read after v2 is saved');
  });
});

describe('the version card', () => {
  it('a splice: length, the bars changed, the length difference (F-048 #1)', () => {
    expect(versionMeta(version())).toBe("3:12 · bars 25-32 changed · the rest is v1's audio · 0.04 s longer than v1");
    expect(versionFoot(version(), true)).toBe('v2 is the active version. v1 is kept.');
    expect(versionWarn(version())).toBeNull();
  });

  it('a CUT: removed, shorter, bars after it earlier', () => {
    const cut = version({ seconds: 172, splice: { kind: 'cut', bars: [57, 64], lengthDiffS: -20 } });
    expect(versionMeta(cut)).toBe('2:52 · bars 57-64 removed · 0:20 shorter · bars after the cut are earlier');
  });

  it('the whole song as planned; the join could not be aligned (rust, EC-5); TRUNCATED', () => {
    expect(versionMeta(version({ whole: true, splice: null }))).toBe('3:12 · the whole song was re-rendered · every bar sounds different from v1');
    const fb = version({ whole: true, splice: null, fallback: 'the join could not be aligned' });
    expect(versionMeta(fb)).toBe('3:12 · saved as the whole re-render, not a splice');
    expect(versionWarn(fb)).toEqual({ title: 'THE JOIN COULD NOT BE ALIGNED', body: 'Every bar sounds different from v1, not only the ones you asked for. Nothing was spliced silently.' });
    expect(versionFoot(fb, true)).toBe('Not what the card promised: BACK TO v1 and USE v1 if you prefer.');
    const tr = version({ seconds: 161, whole: true, splice: null, truncated: true, fallback: null });
    expect(versionMeta(tr)).toBe('2:41 · TRUNCATED');
    expect(versionWarn(tr)?.title).toBe('THE TAKE ENDED AT 2:41');
  });

  it('the version before it was deleted: no A/B', () => {
    expect(versionFoot(version({ previous: null }), true)).toBe('the version before it was deleted in the Editor: no A/B');
    expect(versionMeta(version({ previous: null }))).toBe("3:12 · bars 25-32 changed · the rest is the old take's audio · 0.04 s longer");
  });

  it('BACK TO v1 in the player: the pill on the old version, the status line', () => {
    expect(abOnLabel(1, 2)).toBe('◂ v1 · BACK TO v2');
    expect(abListening(1)).toBe('v1 · NOT ACTIVE');
  });
});

describe('the bar map caption (F-060, chat-converge.html 3a, 4a-4d)', () => {
  const map = (ops: Array<{ spans: Array<[number, number]>; whole: boolean }>) => ({ bars: 80, sections: [], ops });
  const RE: ScoreOp = { op: 'REHARMONIZE', from_bar: 49, to_bar: 56, chords: [] };
  const TEMPO: ScoreOp = { op: 'SET_TEMPO', bpm: 92 };
  const CUT_OP: ScoreOp = { op: 'CUT', section: 9, label: 'outro' };

  it('a splice: the bars that change against the ones that stay', () => {
    expect(mapCaption(map([{ spans: [[49, 56]], whole: false }]), [RE], null, REHARM, 4)).toBe('8 OF 80 BARS CHANGE · THE OTHER 72 ARE v4');
  });
  it('a whole re-render without a whole-song op says the whole song re-renders', () => {
    expect(mapCaption(map([{ spans: [[41, 48]], whole: false }]), [RE], null, WHOLE, 4)).toBe('8 OF 80 BARS CHANGE · THE WHOLE SONG RE-RENDERS');
  });
  it('a whole-song op: all bars change, named, with the edited span', () => {
    expect(mapCaption(map([{ spans: [[49, 56]], whole: false }, { spans: [], whole: true }]), [RE, TEMPO], null, WHOLE, 4))
      .toBe('ALL 80 BARS CHANGE (SET TEMPO) · BARS 49–56 REHARMONIZE');
  });
  it('a CUT says the bars are cut', () => {
    expect(mapCaption(map([{ spans: [[73, 80]], whole: false }]), [CUT_OP], null, CUT, 4)).toBe('8 OF 80 BARS ARE CUT · THE OTHER 72 ARE v4');
  });
  it('a hovered row names its bars and op, LIT; overlapping spans count once', () => {
    const m = map([{ spans: [[49, 56]], whole: false }, { spans: [], whole: true }]);
    expect(mapCaption(m, [RE, TEMPO], 0, WHOLE, 4)).toBe('BARS 49–56 · REHARMONIZE · LIT');
    expect(mapCaption(m, [RE, TEMPO], 1, WHOLE, 4)).toBe('WHOLE SONG · SET TEMPO · LIT');
    const twice = map([{ spans: [[49, 56]], whole: false }, { spans: [[53, 60]], whole: false }]);
    expect(mapCaption(twice, [RE, RE], null, WHOLE, 4)).toBe('12 OF 80 BARS CHANGE · THE WHOLE SONG RE-RENDERS');
  });
});
