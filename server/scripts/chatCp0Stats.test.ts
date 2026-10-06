import { describe, expect, it } from 'vitest';
import { percentile, plannerWindow, stopLines, summarize, summaryMarkdown, type TurnResult } from './chatCp0Stats.js';

const turn = (over: Partial<TurnResult> = {}): TurnResult => ({
  index: 0, id: 't', lang: 'en', expect: 'recipe', prompt: 'p', postStatus: 202, action: 'recipe', cause: null, reasons: [],
  attempts: 1, calls: 1, turnMs: 5000, queuedMs: 0, promptTokens: [2000], unloadMs: 400, vram: null, ...over,
});

describe('percentile', () => {
  it('nearest-rank over the sorted values; null when empty', () => {
    expect(percentile([], 50)).toBeNull();
    expect(percentile([3, 1, 2], 50)).toBe(2);
    expect(percentile([1, 2, 3, 4], 50)).toBe(2);
    expect(percentile(Array.from({ length: 20 }, (_, i) => i + 1), 95)).toBe(19);
    expect(percentile([7], 95)).toBe(7);
  });
});

describe('summarize', () => {
  it('counts actions, invalid-after-3, expectation misses and hand-offs', () => {
    const s = summarize([
      turn({ index: 0, turnMs: 20_000 }),
      turn({ index: 1, id: 'v', expect: 'ask', action: 'recipe', turnMs: 4000 }),
      turn({ index: 2, id: 'f', action: 'failed', cause: 'check', attempts: 3, calls: 3, turnMs: 9000, unloadMs: 6000 }),
      turn({ index: 3, action: 'ask', expect: 'ask', turnMs: 3000, unloadMs: null,
        create: { postStatus: 202, outcome: 'saved', handoffMs: 1200, takeMs: 60_000, songId: 's', seconds: 12 } }),
    ]);
    expect(s.turns).toBe(4);
    expect(s.byAction).toEqual({ recipe: 2, failed: 1, ask: 1 });
    expect(s.invalidAfter3).toBe(1);
    expect(s.expectMisses).toEqual(['v', 'f']);
    expect(s.turnP50S).toBe(4);
    expect(s.turnP95S).toBe(20);
    expect(s.coldS).toBe(20);
    expect(s.warmP50S).toBe(4);
    expect(s.unloadMaxMs).toBe(6000);
    expect(s.createHandoffMs).toEqual([1200]);
    expect(s.takeS).toEqual([60]);
    expect(s.attemptsMax).toBe(3);
  });

  it('a check failure the server refused before any call still counts; a cancel or offline does not', () => {
    const s = summarize([turn({ action: 'failed', cause: 'offline' }), turn({ action: 'failed', cause: 'cancelled' })]);
    expect(s.invalidAfter3).toBe(0);
  });
});

describe('stopLines', () => {
  it('PASS within the lines', () => {
    const lines = stopLines(summarize([turn(), turn({ create: { postStatus: 202, outcome: 'saved', handoffMs: 800, takeMs: 1, songId: 's', seconds: 1 } })]));
    expect(lines.map((l) => l.verdict)).toEqual(['PASS', 'PASS', 'PASS']);
  });

  it('STOP on turn p50 over 15 s, a hand-off over 5 s, and invalid-after-3 more than once', () => {
    const slow = { turnMs: 16_000 };
    const lines = stopLines(summarize([
      turn({ ...slow, action: 'failed', cause: 'check' }), turn({ ...slow, action: 'failed', cause: 'check' }),
      turn({ ...slow, create: { postStatus: 202, outcome: 'saved', handoffMs: 5200, takeMs: 1, songId: 's', seconds: 1 } }),
    ]));
    expect(lines.map((l) => l.verdict)).toEqual(['STOP', 'STOP', 'STOP']);
    expect(lines[1].text).toContain('5.2 s');
  });

  it('exactly one invalid-after-3 still passes; no hand-off measured is NO DATA, not PASS', () => {
    const lines = stopLines(summarize([turn({ action: 'failed', cause: 'check', unloadMs: null })]));
    expect(lines[2].verdict).toBe('PASS');
    expect(lines[1].verdict).toBe('NO DATA');
  });

  it('an unload just over 5 s alone is a STOP', () => {
    expect(stopLines(summarize([turn({ unloadMs: 5001 })]))[1].verdict).toBe('STOP');
  });
});

describe('plannerWindow', () => {
  const ev = (t0: number, t1: number, method: string, path: string, info: Record<string, unknown> = {}) => ({ t0, t1, method, path, info });
  it('calls and prompt tokens inside the window; unload = last call answered -> first empty ps after the ack', () => {
    const events = [
      ev(0, 10, 'POST', '/v1/chat/completions', { usage: { prompt_tokens: 99 } }), // before the window
      ev(1000, 3000, 'POST', '/v1/chat/completions', { usage: { prompt_tokens: 2100 } }),
      ev(3100, 5000, 'POST', '/v1/chat/completions', {}),
      ev(5100, 5150, 'GET', '/api/ps', { models: [{ name: 'q' }] }), // before the ack: ignored
      ev(5200, 5250, 'POST', '/api/generate', {}),
      ev(5300, 5350, 'GET', '/api/ps', { models: [{ name: 'q' }] }),
      ev(5600, 5650, 'GET', '/api/ps', { models: [] }),
    ];
    expect(plannerWindow(events, 900, 6000)).toEqual({ calls: 2, promptTokens: [2100, null], unloadMs: 650 });
  });

  it('no call (offline before any) or no empty ps: unload is null', () => {
    expect(plannerWindow([], 0, 10).unloadMs).toBeNull();
    expect(plannerWindow([ev(0, 5, 'POST', '/v1/chat/completions'), ev(6, 7, 'POST', '/api/generate')], 0, 10))
      .toEqual({ calls: 1, promptTokens: [null], unloadMs: null });
  });
});

describe('summaryMarkdown', () => {
  it('names the stop lines, the numbers and one row per turn', () => {
    const results = [turn({ id: 'en-ballad' }), turn({ id: 'vague-1', expect: 'ask', action: 'ask' })];
    const md = summaryMarkdown(summarize(results), results, { server: 'http://x', date: '2026-10-06' });
    expect(md).toContain('# CP-C0a');
    expect(md).toContain('turn p50 5.0 s');
    expect(md).toMatch(/PASS .*turn p50/);
    expect(md).toContain('| en-ballad |');
    expect(md).toContain('| vague-1 |');
  });
});
