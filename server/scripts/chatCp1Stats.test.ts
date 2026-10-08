import { describe, expect, it } from 'vitest';
import { analysisSteps, markBarsOf, opsOutside, stopLines, summarize, type AnalysisRecord, type ApplyRecord, type TurnRecord } from './chatCp1Stats.js';

const facts = {
  sections: [
    { index: 1, label: 'verse', from_bar: 1, to_bar: 8 },
    { index: 2, label: 'chorus', from_bar: 9, to_bar: 16 },
    { index: 3, label: 'verse', from_bar: 17, to_bar: 24 },
  ],
  lyric_blocks: [
    { index: 1, tag: '[verse]', occurrence: 1 },
    { index: 2, tag: '[chorus]', occurrence: 1 },
    { index: 3, tag: '[verse]', occurrence: 2 },
  ],
};

describe('opsOutside', () => {
  it('passes a REHARMONIZE inside the mark and names one past it', () => {
    expect(opsOutside([{ op: 'REHARMONIZE', from_bar: 9, to_bar: 16, chords: [{ bar: 9 }, { bar: 16 }] }], [9, 16], facts)).toEqual([]);
    expect(opsOutside([{ op: 'REHARMONIZE', from_bar: 9, to_bar: 17, chords: [] }], [9, 16], facts)).toEqual(['op 1 REHARMONIZE: bar 17 outside bars 9-16']);
  });
  it('judges REPEAT / CUT by its section and REWRITE_LYRICS by the section that sings the block', () => {
    expect(opsOutside([{ op: 'REPEAT', section: 2 }], [9, 16], facts)).toEqual([]);
    expect(opsOutside([{ op: 'CUT', section: 1 }], [9, 16], facts)).toEqual(['op 1 CUT: section 1 (bars 1-8) outside bars 9-16']);
    expect(opsOutside([{ op: 'REWRITE_LYRICS', block: 3 }], [17, 20], facts)).toEqual([]);
    expect(opsOutside([{ op: 'REWRITE_LYRICS', block: 3 }], [9, 16], facts)).toEqual(['op 1 REWRITE_LYRICS: block 3 (bars 17-24) outside bars 9-16']);
  });
  it('allows whole-song ops (D-176) and a WRITE_PHRASE that only starts inside', () => {
    expect(opsOutside([{ op: 'SET_TEMPO', bpm: 90 }, { op: 'WRITE_PHRASE', start_bar: 15, bars: ['a', 'b', 'c'] }], [9, 16], facts)).toEqual([]);
    expect(opsOutside([{ op: 'WRITE_PHRASE', start_bar: 7, bars: [] }], [9, 16], facts)).toHaveLength(1);
  });
});

describe('markBarsOf', () => {
  const starts = [0, 2, 4, 6, 8];
  it('keeps the bars a mark carries and maps seconds to the bars they cover', () => {
    expect(markBarsOf({ bars: [2, 3], seconds: [2, 6] }, starts)).toEqual([2, 3]);
    expect(markBarsOf({ seconds: [2.5, 6] }, starts)).toEqual([2, 3]);
    expect(markBarsOf({ seconds: [7, 30] }, starts)).toEqual([4, 5]);
    expect(markBarsOf({ seconds: [1, 2] }, null)).toBeNull();
  });
});

describe('analysisSteps', () => {
  it('times each step from its first progress line to the next step or the end', () => {
    const p = [{ t: 0, text: 'WORDS · lyrics-server' }, { t: 9, text: 'SECTIONS · tracking the beat' }, { t: 12, text: 'SECTIONS · tracking the beat 40%' }];
    expect(analysisSteps(p, 20)).toEqual({ WORDS: 9, SCORE: null, SECTIONS: 11 });
  });
});

const a = (o: Partial<AnalysisRecord>): AnalysisRecord => ({
  song: 's', title: 't', source: 'yue2', trigger: 'save', jobId: 'j', versionId: 'v', number: 2, audioS: 160, status: 'done', error: null,
  queuedMs: 0, runMs: 30_000, steps: { WORDS: 20_000, SCORE: 0, SECTIONS: 10_000 }, plan: null, notRead: null, sections: [], mibPeak: null, mibEnd: null, endAt: null, ...o,
});
const t = (o: Partial<TurnRecord>): TurnRecord => ({
  song: 's', id: 'x', role: 'after-analysis', afterAnalysis: true, text: '', mark: null, markBars: null, postStatus: 202, reason: null, action: 'edit', ops: [], outside: [],
  waitMs: 0, runMs: 10_000, totalMs: 10_000, promptTokens: [3000], plannerOnGpu: true, plannerVram: '10.9 of 10.9 GiB', vramBeforeMiB: 1800, cardNotes: [], ...o,
});
const ap = (o: Partial<ApplyRecord>): ApplyRecord => ({
  song: 's', tag: 'apply2', behind: 'running', analysisJob: 'j', postStatus: 202, reason: null, waitMs: 5000, startedAfterAnalysisMs: 100, outcome: 'saved', editMs: 90_000, versionId: 'v3', ...o,
});

describe('stopLines', () => {
  const base = { analyses: [a({})], turns: [t({}), ...Array.from({ length: 10 }, (_, i) => t({ id: `m${i}`, role: 'marked', afterAnalysis: false }))], applies: [ap({})] };
  it('passes a clean run', () => {
    expect(stopLines(summarize(base)).map((l) => l.verdict)).toEqual(['PASS', 'PASS', 'PASS', 'PASS', 'PASS']);
  });
  it('stops on a refused APPLY, a slow analysis, a spilled planner, two ops outside and a fat prompt', () => {
    const bad = {
      analyses: [a({ runMs: 95_000 })],
      turns: [t({ plannerOnGpu: false }), ...Array.from({ length: 10 }, (_, i) => t({ id: `m${i}`, role: 'marked', afterAnalysis: false, outside: i < 2 ? ['op 1'] : [], promptTokens: [7000] }))],
      applies: [ap({ postStatus: 409, reason: 'a chat analysis was queued' })],
    };
    expect(stopLines(summarize(bad)).map((l) => l.verdict)).toEqual(['STOP', 'STOP', 'STOP', 'STOP', 'STOP']);
  });
  it('counts a mark refused at SEND apart, not as a marked turn', () => {
    const s = summarize({ ...base, turns: [...base.turns, t({ id: 'r', role: 'marked', postStatus: 400, action: null, promptTokens: [] })] });
    expect([s.marked, s.markRefused.length]).toEqual([10, 1]);
    expect(stopLines(s)[3].text).toContain('0 of 10 (10 edit cards; 1 mark refused at SEND)');
  });
  it('ignores the 90 s line for a version over 4 min', () => {
    expect(stopLines(summarize({ ...base, analyses: [a({ runMs: 120_000, audioS: 300 }), a({ runMs: 40_000 })] }))[1].verdict).toBe('PASS');
  });
});
