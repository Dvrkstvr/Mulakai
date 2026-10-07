/** The player's analysis store against a mocked server (F-052): the view read on open, the job followed to its end and
 * the view read again, an unread version read again a few times, RETRY started / refused, another song resets. */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { AnalysisView } from './api/chatAnalysis';
import { READING, view } from './chatMarkFixture';

const { ApiError } = await vi.importActual<typeof import('./api/http')>('./api/http');
const jobStatus = vi.fn();
vi.mock('./api', () => ({ ApiError, api: { jobStatus } }));
const chatAnalysisApi = { analysisView: vi.fn<(songId: string) => Promise<AnalysisView>>(), retryAnalysis: vi.fn(), markPreview: vi.fn() };
vi.mock('./api/chatAnalysis', async (actual) => ({ ...(await actual<object>()), chatAnalysisApi }));

const { useChatAnalysisStore, UNREAD_RETRIES, UNREAD_RETRY_MS } = await import('./chatAnalysisStore');
const { readingLine, stripMode } = await import('./chatAnalysis');
const store = () => useChatAnalysisStore.getState();
const line = () => readingLine(store().analysis)?.text;

const queued = view({ state: { kind: 'queued', jobId: 'j1', ahead: 1 }, shown: { ...READING, mode: 'dim' } });
const failed = view({ state: { kind: 'failed', reason: 'lyrics-server did not answer in 60 s', at: 'x' }, shown: null });

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  useChatAnalysisStore.setState({ songId: null, analysis: { view: null, poll: null, retry: null } });
});
afterEach(async () => {
  await store().open(null);
  vi.useRealTimers();
});

describe('chatAnalysisStore', () => {
  it('reads the view on open: a done reading shows the line and a live strip', async () => {
    chatAnalysisApi.analysisView.mockResolvedValue(view());
    await store().open('s1');
    expect(chatAnalysisApi.analysisView).toHaveBeenCalledWith('s1');
    expect(line()).toBe('READ v4 · 5 SECTIONS · 8 LINES');
    expect(stripMode(store().analysis)).toBe('live');
  });

  it('follows a queued job through its steps and reads the view again when it ends', async () => {
    chatAnalysisApi.analysisView.mockResolvedValueOnce(queued).mockResolvedValueOnce(view());
    jobStatus.mockResolvedValueOnce({ status: 'running', progressText: 'SCORE · transcribing 41%' }).mockResolvedValueOnce({ status: 'done' });
    await store().open('s1');
    expect(line()).toBe('READING v4 · QUEUED · STARTS AFTER 1 JOB');
    expect(stripMode(store().analysis)).toBe('dim');
    await vi.advanceTimersByTimeAsync(1500);
    expect(jobStatus).toHaveBeenCalledWith('j1');
    expect(line()).toBe('READING v4 · SCORE · 2 OF 3 · transcribing 41%');
    await vi.advanceTimersByTimeAsync(1500);
    expect(chatAnalysisApi.analysisView).toHaveBeenCalledTimes(2);
    expect(line()).toBe('READ v4 · 5 SECTIONS · 8 LINES');
  });

  it('reads an unread version again a few times, then stops', async () => {
    chatAnalysisApi.analysisView.mockResolvedValue(view({ versionId: 'v5', number: 5, state: { kind: 'none' }, shown: { ...READING, mode: 'dim' } }));
    await store().open('s1');
    await vi.advanceTimersByTimeAsync(UNREAD_RETRY_MS * (UNREAD_RETRIES + 2));
    expect(chatAnalysisApi.analysisView).toHaveBeenCalledTimes(1 + UNREAD_RETRIES);
  });

  it('RETRY on a failed reading queues a new job and follows it', async () => {
    chatAnalysisApi.analysisView.mockResolvedValueOnce(failed).mockResolvedValueOnce(view());
    chatAnalysisApi.retryAnalysis.mockResolvedValue({ jobId: 'j2' });
    jobStatus.mockResolvedValue({ status: 'done' });
    await store().open('s1');
    expect(readingLine(store().analysis)).toMatchObject({ tone: 'failed', retry: true });
    expect(stripMode(store().analysis)).toBe('hatched');
    await store().retry();
    expect(chatAnalysisApi.retryAnalysis).toHaveBeenCalledWith('s1');
    expect(line()).toBe('READING v4 · QUEUED · STARTS NOW');
    await vi.advanceTimersByTimeAsync(1500);
    expect(line()).toBe('READ v4 · 5 SECTIONS · 8 LINES');
  });

  it('a refused RETRY says why and keeps RETRY', async () => {
    chatAnalysisApi.analysisView.mockResolvedValue(failed);
    chatAnalysisApi.retryAnalysis.mockResolvedValue({ refused: 'a reading is already queued' });
    await store().open('s1');
    await store().retry();
    expect(readingLine(store().analysis)).toMatchObject({ tone: 'failed', retry: true });
    expect(line()).toContain('RETRY refused: a reading is already queued');
  });

  it('RETRY does nothing unless the reading failed', async () => {
    chatAnalysisApi.analysisView.mockResolvedValue(view());
    await store().open('s1');
    await store().retry();
    expect(chatAnalysisApi.retryAnalysis).not.toHaveBeenCalled();
  });

  it('another song starts empty; a late view of the old one is dropped', async () => {
    let late: (v: AnalysisView) => void = () => {};
    chatAnalysisApi.analysisView.mockReturnValueOnce(new Promise((r) => { late = r; })).mockResolvedValueOnce(view({ songId: 's2' }));
    const first = store().open('s1');
    await store().open('s2');
    late(failed);
    await first;
    expect(store().songId).toBe('s2');
    expect(store().analysis.view?.songId).toBe('s2');
  });
});
