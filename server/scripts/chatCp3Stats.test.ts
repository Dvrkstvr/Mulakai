import { describe, expect, it } from 'vitest';
import { plannerOnGpu, stepDurations, stopLines, summarize, summaryMarkdown, useRight, type FollowRecord, type Leg, type ReadingRecord } from './chatCp3Stats.js';

const reading = (over: Partial<ReadingRecord> = {}): ReadingRecord => ({
  jobId: 'r', status: 'done', error: null, handoffMs: 300, readingMs: 60_000, steps: { WORDS: 1, SCORE: 50_000, CAPTION: 9000 },
  seconds: 200, readTo: 200, cut: false, plan: { words: 'own', score: 'service', caption: 'own' }, words: 'en, 20 lines', score: 'ok', caption: 'own',
  scoreOk: true, coverable: 'yes', ...over,
} as ReadingRecord);
const follow = (over: Partial<FollowRecord> = {}): FollowRecord => ({
  jobId: 'f', action: 'recipe', cause: null, reasons: [], handoffMs: 200, turnMs: 9000, promptTokens: [3000], unloadMs: 600,
  vramBeforeMiB: 1200, plannerOnGpu: true, plannerVram: '10.9 of 10.9 GiB on the GPU', referenceUse: 'cover', finalUse: 'cover',
  borrowed: ['bpm'], missing: [], note: null, ...over,
});
const leg = (over: Partial<Leg> = {}): Leg => ({
  id: 'l', source: 'acestep', name: 'n', lang: 'en', expect: 'cover', text: 't', attach: { status: 201, ms: 50, reason: null },
  ask: { action: 'analyze', turnMs: 8000, reasons: [] }, reading: reading(), followUp: follow(), ...over,
});

describe('stepDurations', () => {
  it('first sight of each step to the next seen step or the end; unseen steps are null', () => {
    const p = [{ t: 100, text: 'WORDS' }, { t: 150, text: 'WORDS' }, { t: 200, text: 'SCORE · transcribing 3%' }, { t: 900, text: 'SCORE · checking the score' }];
    expect(stepDurations(p, 1000)).toEqual({ WORDS: 100, SCORE: 800, CAPTION: null });
    expect(stepDurations([{ t: 10, text: 'CAPTION · ACE-Step' }], 40)).toEqual({ WORDS: null, SCORE: null, CAPTION: 30 });
    expect(stepDurations([], 5)).toEqual({ WORDS: null, SCORE: null, CAPTION: null });
  });
});

describe('plannerOnGpu', () => {
  const m = (size_vram: number) => ({ name: 'qwen3:14b', size: 100, size_vram });
  it('true only when every sample in the window has the whole model on the GPU', () => {
    expect(plannerOnGpu([{ t: 5, models: [m(100)] }, { t: 6, models: [m(100)] }], 0, 10).on).toBe(true);
    expect(plannerOnGpu([{ t: 5, models: [m(100)] }, { t: 6, models: [m(80)] }], 0, 10).on).toBe(false);
    expect(plannerOnGpu([{ t: 50, models: [m(80)] }, { t: 5, models: [] }], 0, 10)).toEqual({ on: null, vram: null });
  });
});

describe('summarize and stopLines', () => {
  it('passes a clean run', () => {
    const s = summarize([leg({ id: 'a' }), leg({ id: 'b', expect: 'borrow', followUp: follow({ referenceUse: 'borrow' }) }), leg({ id: 'c', source: 'yue2', reading: reading({ scoreOk: false }) })]);
    expect(s.scoreOk).toBe(2);
    expect(s.audioFiles).toBe(2);
    expect(s.useRight).toBe(3);
    expect(stopLines(s).map((l) => l.verdict)).toEqual(['PASS', 'PASS', 'PASS', 'PASS', 'PASS']);
  });

  it('stops on each line', () => {
    const legs = [
      leg({ id: 'slow', reading: reading({ readingMs: 250_000, scoreOk: false }), followUp: follow({ turnMs: 20_000, plannerOnGpu: false }) }),
      leg({ id: 'long', reading: reading({ seconds: 400, readingMs: 500_000 }), followUp: follow({ referenceUse: 'borrow', turnMs: 16_000, handoffMs: 6000 }) }),
      leg({ id: 'up', source: 'upload', reading: reading({ scoreOk: false }), followUp: follow({ referenceUse: null }) }),
    ];
    const s = summarize(legs);
    expect(s.readingMaxShortS).toBe(250);
    expect(s.plannerOff).toEqual(['slow']);
    expect(s.useRight).toBe(1);
    expect(stopLines(s).map((l) => l.verdict)).toEqual(['STOP', 'STOP', 'STOP', 'STOP', 'STOP']);
  });

  it('a non-audio refusal is not judged; no data reads NO DATA', () => {
    const bad = leg({ id: 'txt', source: 'non-audio', expect: 'refuse', ask: null, reading: null, followUp: null, attach: { status: 400, ms: 5, reason: 'not audio' } });
    expect(useRight(bad)).toBe(false);
    const s = summarize([bad]);
    expect(s.useJudged).toBe(0);
    expect(stopLines(s).every((l) => l.verdict === 'NO DATA')).toBe(true);
    expect(summaryMarkdown(s, [bad], { server: 'x', date: 'd' })).toContain('attach 400: not audio');
  });
});
