/** SPLIT dock downloads: names from the layer and the stem, only ready unclaimed takes, staggered DOWNLOAD ALL, and
 * which stems SPLIT ALL AGAIN re-takes. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StemResult } from './api';
import { DOWNLOAD_GAP_MS, downloadAll, splitAgainKinds, stemDownload, stemDownloads } from './splitDownloads';

const done = (kind: StemResult['kind'], extra: Partial<StemResult> = {}): StemResult =>
  ({ kind, status: 'done', audioFile: `abc-${kind}.flac`, ...extra });

describe('stemDownload', () => {
  it("names the file after the layer and the stem, keeping the take's extension", () => {
    expect(stemDownload(done('vocals'), 'Base')).toEqual({ href: '/audio/abc-vocals.flac', name: 'Base - Vocals.flac' });
  });

  it('nothing while running, failed, or once claimed', () => {
    expect(stemDownload({ kind: 'bass', status: 'running' }, 'Base')).toBeNull();
    expect(stemDownload({ kind: 'bass', status: 'failed', error: 'x' }, 'Base')).toBeNull();
    expect(stemDownload(done('bass', { claimed: 'added' }), 'Base')).toBeNull();
  });
});

describe('downloadAll', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('one download per ready stem, each a gap after the last', () => {
    const list = stemDownloads([done('vocals'), { kind: 'drums', status: 'running' }, done('bass')], 'Base');
    const click = vi.fn();
    downloadAll(list, click);
    vi.advanceTimersByTime(0);
    expect(click.mock.calls.map(([d]) => d.name)).toEqual(['Base - Vocals.flac']);
    vi.advanceTimersByTime(DOWNLOAD_GAP_MS);
    expect(click.mock.calls.map(([d]) => d.name)).toEqual(['Base - Vocals.flac', 'Base - Bass.flac']);
  });
});

describe('splitAgainKinds', () => {
  it('every stem not claimed and not running, failed ones included', () => {
    const stems: StemResult[] = [done('vocals', { claimed: 'replaced' }), done('drums'), { kind: 'bass', status: 'failed' }, { kind: 'other', status: 'running' }];
    expect(splitAgainKinds(stems)).toEqual(['drums', 'bass']);
  });
});
