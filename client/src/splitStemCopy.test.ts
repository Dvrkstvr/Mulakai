import { describe, expect, it } from 'vitest';
import { stemClaimLine } from './splitStemCopy';
import { SCORE_ENDS } from './scoreCopy';

describe('extract-to-layer consequence (stem KEEP AS LAYER / USE AS <LAYER> TAKE)', () => {
  it('states what each claim saves, then that score editing ends while SCORE is open', () => {
    expect(stemClaimLine('Base', 2, true)).toEqual({ line: 'keep adds a lane · use saves base v2', scoreEnds: SCORE_ENDS });
  });

  it('leaves the clause out where SCORE is hidden or already ineligible', () => {
    expect(stemClaimLine('Base', 3, false)).toEqual({ line: 'keep adds a lane · use saves base v3', scoreEnds: null });
  });
});
