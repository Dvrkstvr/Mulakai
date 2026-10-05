import { describe, expect, it } from 'vitest';
import { editConsequence, scoreOpen } from './scoreEnds';
import { SCORE_ENDS } from './scoreCopy';
import { INITIAL_SCORE, type ScorePhase, type ScoreVerbState } from './scoreVerbTypes';

const at = (phase: ScorePhase): ScoreVerbState => ({ ...INITIAL_SCORE, phase });

describe('scoreOpen (F-027)', () => {
  it('is open while the SCORE tab is on show and usable, offline included (the edit still closes it)', () => {
    expect(scoreOpen(at({ kind: 'asking' }))).toBe(true);
    expect(scoreOpen(at({ kind: 'ready' }))).toBe(true);
    expect(scoreOpen(at({ kind: 'planning', attempt: 1, note: null, cancelling: false }))).toBe(true);
    expect(scoreOpen(at({ kind: 'offline', reason: 'planner offline', source: 'planner' }))).toBe(true);
    expect(scoreOpen(at({ kind: 'done', saved: 'Saved base v2', truncated: false }))).toBe(true);
  });

  it('is closed where SCORE is hidden (ACE-Step song, LLM_API_URL unset, not loaded yet) or ineligible', () => {
    expect(scoreOpen(INITIAL_SCORE)).toBe(false);
    expect(scoreOpen(at({ kind: 'hidden' }))).toBe(false);
    expect(scoreOpen(at({ kind: 'ineligible', reason: 'the song has a repaint version' }))).toBe(false);
  });
});

describe('editConsequence', () => {
  it('carries the D-030 clause only while SCORE is open', () => {
    expect(SCORE_ENDS).toBe('score editing ends after this edit, SCORE will be off for this song');
    expect(editConsequence('Saves base v2', true)).toEqual({ line: 'Saves base v2', scoreEnds: SCORE_ENDS });
    expect(editConsequence('Saves base v2', false)).toEqual({ line: 'Saves base v2', scoreEnds: null });
  });
});
