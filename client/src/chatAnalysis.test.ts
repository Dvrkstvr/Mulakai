/** The reading line and strip mode (F-052, F-053; CS-3, CS-4): one test per state, RETRY, the poll, the composer's
 * waiting line (Q-069). */
import { describe, it, expect } from 'vitest';
import type { AnalysisView } from './api/chatAnalysis';
import {
  INITIAL_ANALYSIS, TRANSCRIBED_LINE, analysisJob, analysisRunning, analysisSettled, analysisWaitLine, chatAnalysis, readingLine, stripMode,
  type AnalysisEvent, type AnalysisState,
} from './chatAnalysis';
import { READING, v5, view } from './chatMarkFixture';

const run = (...events: AnalysisEvent[]): AnalysisState => events.reduce(chatAnalysis, INITIAL_ANALYSIS);
const withView = (v: AnalysisView, ...more: AnalysisEvent[]) => run({ type: 'view', view: v }, ...more);

describe('readingLine', () => {
  it('done: READ v4 · sections · lines; the strip is live', () => {
    const s = withView(view());
    expect(readingLine(s)).toEqual({ text: 'READ v4 · 5 SECTIONS · 8 LINES', tone: 'quiet', retry: false, transcribed: null });
    expect(stripMode(s)).toBe('live');
  });

  it('no word timings is said, not a failure (F-052 #4)', () => {
    expect(readingLine(withView(view({ shown: { ...READING, notRead: { words: 'LYRICS_API_URL is not set', score: null, bars: null } } })))!.text)
      .toBe('READ v4 · 5 SECTIONS · 8 LINES · NO WORD TIMINGS');
  });

  it('a score longer than its audio says how many bars the strip leaves out (D-197)', () => {
    expect(readingLine(withView(view({ shown: { ...READING, transcribed: true, barsNotShown: 39 } })))!.text)
      .toBe('READ v4 · 5 SECTIONS · 8 LINES · SCORE LONGER THAN THE AUDIO · 39 BARS NOT SHOWN');
    expect(readingLine(withView(view({ shown: { ...READING, barsNotShown: 1 } })))!.text).toMatch(/· 1 BAR NOT SHOWN$/);
  });

  it('a transcribed score gets its second line', () => {
    expect(readingLine(withView(view({ shown: { ...READING, transcribed: true } })))!.transcribed).toBe(TRANSCRIBED_LINE);
  });

  it('queued: READING v5 · QUEUED · STARTS AFTER n, from the view then the poll', () => {
    const s = withView(v5(false, null, { ...READING, mode: 'dim' }));
    const q = withView({ ...s.view!, state: { kind: 'queued', jobId: 'a1', ahead: 2 } });
    expect(readingLine(q)!.text).toBe('READING v5 · QUEUED · STARTS AFTER 2 JOBS');
    expect(stripMode(q)).toBe('dim');
    const polled = chatAnalysis(q, { type: 'poll', jobId: 'a1', job: { status: 'queued', queuePosition: 1 } });
    expect(readingLine(polled)!.text).toBe('READING v5 · QUEUED · STARTS AFTER 1 JOB');
    expect(analysisJob(polled)).toBe('a1');
  });

  it('running: the step k of 3 and its note', () => {
    const r = withView(view({ state: { kind: 'running', jobId: 'a1', step: 'WORDS', progress: null } }));
    expect(readingLine(r)).toMatchObject({ text: 'READING v4 · WORDS · 1 OF 3', tone: 'running', retry: false });
    const p = chatAnalysis(r, { type: 'poll', jobId: 'a1', job: { status: 'running', progressText: 'SCORE · transcribing 41%' } });
    expect(readingLine(p)!.text).toBe('READING v4 · SCORE · 2 OF 3 · transcribing 41%');
  });

  it('running from the view alone: the server’s `progress` names the step; none named reads WORDS', () => {
    const p = withView(view({ state: { kind: 'running', jobId: 'a1', step: null, progress: 'SECTIONS' } }));
    expect(readingLine(p)!.text).toBe('READING v4 · SECTIONS · 3 OF 3');
    expect(readingLine(withView(view({ state: { kind: 'running', jobId: 'a1', step: null, progress: null } })))!.text)
      .toBe('READING v4 · WORDS · 1 OF 3');
  });

  it('a poll for another job is ignored', () => {
    const r = withView(view({ state: { kind: 'running', jobId: 'a1', step: 'SECTIONS', progress: null } }));
    expect(chatAnalysis(r, { type: 'poll', jobId: 'zz', job: { status: 'done' } })).toBe(r);
  });

  it('failed: COULDN’T READ with the reason and RETRY; the strip hatches when nothing older fits', () => {
    const f = withView(v5(true, null, null));
    const failed = withView({ ...f.view!, state: { kind: 'failed', reason: 'lyrics-server did not answer in 60 s', at: '' } });
    expect(readingLine(failed)).toEqual({ text: 'COULDN\'T READ v5 · lyrics-server did not answer in 60 s', tone: 'failed', retry: true, transcribed: null });
    expect(stripMode(failed)).toBe('hatched');
  });

  it('a poll that failed reads as failed before the view refetches', () => {
    const r = withView(view({ state: { kind: 'running', jobId: 'a1', step: 'SCORE', progress: null } }));
    const p = chatAnalysis(r, { type: 'poll', jobId: 'a1', job: { status: 'failed', error: 'audio unreadable' } });
    expect(analysisSettled(p)).toBe(true);
    expect(readingLine(p)).toMatchObject({ text: 'COULDN\'T READ v4 · audio unreadable', retry: true });
  });

  it('RETRY: posting hides it, a refusal says why, a start queues the job', () => {
    const failed = withView(view({ state: { kind: 'failed', reason: 'GPU busy', at: '' } }));
    const posting = chatAnalysis(failed, { type: 'retry' });
    expect(readingLine(posting)!.retry).toBe(false);
    expect(chatAnalysis(posting, { type: 'retry' })).toBe(posting);
    const refused = chatAnalysis(posting, { type: 'retryRefused', reason: 'a model is still loaded' });
    expect(readingLine(refused)).toMatchObject({ text: 'COULDN\'T READ v4 · GPU busy · RETRY refused: a model is still loaded', retry: true });
    const started = chatAnalysis(posting, { type: 'retryStarted', jobId: 'a2' });
    expect(readingLine(started)!.text).toBe('READING v4 · QUEUED · STARTS NOW');
    expect(chatAnalysis(withView(view()), { type: 'retry' }).retry).toBeNull(); // nothing failed
  });

  it('hatched: an older reading whose edit moved bars', () => {
    expect(stripMode(withView(v5(true, null, { ...READING, mode: 'hatched' })))).toBe('hatched');
  });

  it('nothing read yet; no playable version reads no line', () => {
    const s = withView(view({ shown: null, state: { kind: 'none' } }));
    expect(readingLine(s)!.text).toBe('v4 · NOT READ YET');
    expect(stripMode(s)).toBe('none');
    expect(readingLine(withView(view({ versionId: null, number: null })))).toBeNull();
    expect(readingLine(INITIAL_ANALYSIS)).toBeNull();
  });
});

describe('the composer while a reading runs (Q-069)', () => {
  it('says a message waits for the reading; nothing once it settled', () => {
    const r = withView(v5(false, null, { ...READING, mode: 'dim' }));
    const running = withView({ ...r.view!, state: { kind: 'running', jobId: 'a1', step: 'WORDS', progress: null } });
    expect(analysisRunning(running)).toBe(true);
    expect(analysisWaitLine(running)).toBe('READING v5 · a message sent now starts after it');
    const done = chatAnalysis(running, { type: 'poll', jobId: 'a1', job: { status: 'done' } });
    expect(analysisWaitLine(done)).toBeNull();
    expect(analysisWaitLine(withView(view()))).toBeNull();
  });
});
