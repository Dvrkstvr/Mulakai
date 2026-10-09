/** A chain's words (C4, F-069; D-263..D-266, D-270): consequence, strip, phase, done and version lines for 2-4 spans. */
import { describe, expect, it } from 'vitest';
import type { ChatSplice, ChatVersionBody } from './api/chatEdit';
import {
  NO_RENDER, severalConsequence, severalDoneLine, severalSplicingTitle, severalStripLine, severalVersionParts, shiftFoot, stepsClause,
  type SeveralSplice,
} from './chatSpliceCopy';
import { applyJobLine, applySteps, editConsequence, editDoneLine, stripLine, versionFoot, versionMeta } from './chatEditCopy';

/** Steps last bar first, as spliceEligibility answers them. */
const chain = (...steps: Array<[SeveralSplice['steps'][number]['kind'], number, number]>): SeveralSplice => ({
  splice: true, kind: 'several', from_bar: Math.min(...steps.map((s) => s[1])), to_bar: Math.max(...steps.map((s) => s[2])),
  steps: steps.sort((a, b) => b[1] - a[1]).map(([kind, from_bar, to_bar], i) => ({ kind, from_bar, to_bar, ops: [i] })),
});
const TWO_REHARM = chain(['reharmonize', 9, 16], ['reharmonize', 41, 48]);
const REHARM_CUT = chain(['reharmonize', 43, 43], ['cut', 47, 62]);
const CUT_REPEAT = chain(['cut', 1, 10], ['repeat', 47, 62]);
const FOUR = chain(['reharmonize', 3, 6], ['cut', 17, 24], ['reharmonize', 33, 36], ['repeat', 49, 56]);
const CHORDS = { cot: 'full', reason: 'chords' } as const;

describe('the several-span edit card', () => {
  it('names every span by kind, in reading order', () => {
    expect(stepsClause(TWO_REHARM.steps)).toBe('re-sings bars 9-16 and 41-48');
    expect(stepsClause(REHARM_CUT.steps)).toBe('re-sings bar 43, cuts bars 47-62');
    expect(stepsClause(FOUR.steps)).toBe('re-sings bars 3-6 and 33-36, cuts bars 17-24, repeats bars 49-56');
  });

  it('a chain with a REHARMONIZE uses the GPU once; only its re-sung bars may change instruments', () => {
    const line = severalConsequence(TWO_REHARM, 3, 4);
    expect(line).toBe('Uses the GPU, one render, a few minutes · re-sings bars 9-16 and 41-48, instruments in the re-sung bars may change, every other bar stays v3\'s audio · length may differ by under 0.25 s at each re-sung span · if any join cannot be aligned, the whole song is re-rendered instead · saves v4, v3 is kept');
    expect(severalConsequence(REHARM_CUT, 1, 2)).toContain('Uses the GPU, one render');
    expect(severalConsequence(REHARM_CUT, 1, 2)).toContain('bars after the cut are earlier, so BACK TO v1 will not line up there');
  });

  it('a chain of CUT / REPEAT only says no GPU and no render (F-066 words), and what moves', () => {
    const line = severalConsequence(CUT_REPEAT, 1, 2);
    expect(line.startsWith(NO_RENDER)).toBe(true);
    expect(line).not.toContain('GPU,');
    expect(line).toContain('cuts bars 1-10, repeats bars 47-62, every other bar stays v1\'s audio');
    expect(line).toContain('bars after the cut are earlier and after the copy are later, so BACK TO v1 will not line up there');
    expect(line).toContain('if any join cannot be aligned, the whole song is re-rendered instead');
  });

  it('editConsequence delegates a chain and keeps the queue suffix', () => {
    expect(editConsequence(REHARM_CUT, CHORDS, 1, 2, 0)).toBe(severalConsequence(REHARM_CUT, 1, 2));
    expect(editConsequence(REHARM_CUT, CHORDS, 1, 2, 2)).toMatch(/v1 is kept · starts after 2 jobs$/i);
    expect(editConsequence(REHARM_CUT, CHORDS, 1, 2, 0)).not.toContain('undefined');
  });

  it('the strip line names each span; the other bars are the rest of the song as read', () => {
    expect(severalStripLine(REHARM_CUT, 65, 1)).toBe('BAR 43 CHANGES · BARS 47-62 ARE CUT · THE OTHER 48 ARE v1');
    expect(stripLine(FOUR, 80, 2)).toBe('BARS 3-6 CHANGE · BARS 17-24 ARE CUT · BARS 33-36 CHANGE · BARS 49-56 PLAY TWICE · THE OTHER 56 ARE v2');
  });

  it('the apply steps: rendering only when a step re-sings; the phase line names the step yue-server is on', () => {
    expect(applySteps(REHARM_CUT)).toEqual(['rendering', 'splicing', 'saving']);
    expect(applySteps(CUT_REPEAT)).toEqual(['splicing', 'saving']);
    // yue-server splices last bar first: step 1 of 2 is the cut (47-62), step 2 the re-sung bar 43.
    expect(severalSplicingTitle(REHARM_CUT, 'splicing 1/2')).toBe('SPLICING · 1 OF 2 · BARS 47-62');
    expect(severalSplicingTitle(REHARM_CUT, 'splicing 2/2')).toBe('SPLICING · 2 OF 2 · BAR 43');
    expect(severalSplicingTitle(FOUR, 'tracking_base')).toBe('SPLICING · 4 SPANS into the old take');
    expect(applyJobLine({ kind: 'running', progressText: 'splicing', stage: 'splicing 2/4', progress: null }, FOUR, 3))
      .toMatchObject({ title: 'SPLICING · 2 OF 4 · BARS 33-36', tail: 'step 2 of 3', cancel: true });
    expect(applyJobLine({ kind: 'running', progressText: 'splicing', stage: 'splicing 1/2', progress: null }, CUT_REPEAT, 2))
      .toMatchObject({ title: 'SPLICING · 1 OF 2 · BARS 47-62', tail: 'step 1 of 2' });
    // A CUT / REPEAT chain whose join fell back renders the whole song: not one of its planned steps.
    expect(applyJobLine({ kind: 'running', progressText: 'rendering', stage: null, progress: null }, CUT_REPEAT, 2))
      .toMatchObject({ title: 'RENDERING · WHOLE SONG · YUE2', tail: null });
  });

  it('the done line lists every span', () => {
    expect(severalDoneLine(TWO_REHARM)).toBe('DONE · BARS 9-16, BARS 41-48');
    expect(editDoneLine(REHARM_CUT as ChatSplice)).toBe('DONE · BAR 43, BARS 47-62');
  });
});

describe('the several-span version card', () => {
  const v = (steps: Array<{ kind: 'reharmonize' | 'cut' | 'repeat'; bars: [number, number] }>, lengthDiffS: number | null): ChatVersionBody => ({
    chat_v: 1, seconds: 140, label: 'score edit · bar 43 spliced · bars 47–62 cut', number: 2, truncated: false, whole: false,
    splice: { kind: 'several', bars: [steps[0].bars[0], steps.at(-1)!.bars[1]], lengthDiffS, steps }, fallback: null, previous: { versionId: 'v1', number: 1 },
  });
  const mixed = v([{ kind: 'reharmonize', bars: [43, 43] }, { kind: 'cut', bars: [47, 62] }], -44.1);

  it('meta: every span and what it did, the rest is the previous take, the length, what moved', () => {
    expect(versionMeta(mixed)).toBe('2:20 · bar 43 changed, bars 47-62 removed · the rest is v1\'s audio · 0:44 shorter · bars after the cut are earlier');
    expect(versionMeta(v([{ kind: 'reharmonize', bars: [9, 16] }, { kind: 'reharmonize', bars: [41, 48] }], 0.04)))
      .toBe('2:20 · bars 9-16 changed, bars 41-48 changed · the rest is v1\'s audio · 0.04 s longer than v1');
    expect(severalVersionParts({ kind: 'several', bars: [1, 8], lengthDiffS: null, steps: [{ kind: 'repeat', bars: [1, 8] }] }, 'the old take', null))
      .toEqual(['bars 1-8 repeated', 'the rest is the old take\'s audio', 'bars after the copy are later']);
  });

  it('foot: BACK TO stops lining up at the first cut or copy; a re-sung-only chain keeps the plain foot', () => {
    expect(versionFoot(mixed, true)).toBe('BACK TO v1 plays the same seconds, which no longer line up from bar 47.');
    expect(versionFoot(v([{ kind: 'reharmonize', bars: [3, 6] }, { kind: 'repeat', bars: [17, 24] }, { kind: 'cut', bars: [41, 48] }], 0), true))
      .toBe('BACK TO v1 plays the same seconds, which no longer line up after bar 24.');
    expect(versionFoot(v([{ kind: 'reharmonize', bars: [9, 16] }, { kind: 'reharmonize', bars: [41, 48] }], 0), true)).toBe('v2 is the active version. v1 is kept.');
    expect(shiftFoot([{ kind: 'cut', bars: [57, 64] }], 3)).toBe('BACK TO v3 plays the same seconds, which no longer line up from bar 57.');
  });
});
