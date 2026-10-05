import { describe, expect, it } from 'vitest';
import { stemClaimLine } from './splitStemCopy';
import { SCORE_ENDS } from './scoreCopy';

describe('extract-to-layer consequence (stem REPLACE / ADD LAYER)', () => {
  it('states what each claim saves, then that score editing ends while SCORE is open', () => {
    expect(stemClaimLine(2, true)).toEqual({ line: 'replace will save as v2 · add will create a new layer', scoreEnds: SCORE_ENDS });
  });

  it('leaves the clause out where SCORE is hidden or already ineligible', () => {
    expect(stemClaimLine(3, false)).toEqual({ line: 'replace will save as v3 · add will create a new layer', scoreEnds: null });
  });
});
