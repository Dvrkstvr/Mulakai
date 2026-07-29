import { describe, it, expect, vi } from 'vitest';
import { createPeaksLoader, type PeaksDecoder } from './waveformPeaks';

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('createPeaksLoader', () => {
  it('decodes a url+buckets pair once and serves the cache after', async () => {
    const decode = vi.fn<PeaksDecoder>(async () => [1, 2]);
    const loader = createPeaksLoader(decode);
    const a = await loader.load('u', 140);
    const b = await loader.load('u', 140);
    expect(a).toBe(b);
    expect(decode).toHaveBeenCalledTimes(1);
  });

  it('dedupes concurrent in-flight loads', async () => {
    const decode = vi.fn<PeaksDecoder>(async () => [1]);
    const loader = createPeaksLoader(decode);
    const [a, b] = await Promise.all([loader.load('u', 140), loader.load('u', 140)]);
    expect(a).toBe(b);
    expect(decode).toHaveBeenCalledTimes(1);
  });

  it('caches per bucket count', async () => {
    const decode = vi.fn<PeaksDecoder>(async (_u, buckets) => [buckets]);
    const loader = createPeaksLoader(decode);
    expect(await loader.load('u', 140)).toEqual([140]);
    expect(await loader.load('u', 400)).toEqual([400]);
    expect(decode).toHaveBeenCalledTimes(2);
  });

  it('does not cache failures — a retry decodes again', async () => {
    const decode = vi
      .fn<PeaksDecoder>()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce([9]);
    const loader = createPeaksLoader(decode);
    await expect(loader.load('u', 140)).rejects.toThrow('network');
    await flush(); // let the internal catch clear the entry
    expect(await loader.load('u', 140)).toEqual([9]);
    expect(decode).toHaveBeenCalledTimes(2);
  });

  it('evict drops every bucket size for the url, others untouched', async () => {
    const decode = vi.fn<PeaksDecoder>(async () => [1]);
    const loader = createPeaksLoader(decode);
    await loader.load('u', 140);
    await loader.load('u', 400);
    await loader.load('other', 140);
    loader.evict('u');
    await loader.load('u', 140);
    await loader.load('u', 400);
    await loader.load('other', 140);
    expect(decode).toHaveBeenCalledTimes(5); // u re-decoded twice, other cached
  });

  it('a stale failure does not evict a fresh replacement entry', async () => {
    let reject!: (e: Error) => void;
    const first = new Promise<number[]>((_res, rej) => (reject = rej));
    const decode = vi.fn<PeaksDecoder>().mockReturnValueOnce(first).mockResolvedValue([7]);
    const loader = createPeaksLoader(decode);
    const stale = loader.load('u', 140);
    stale.catch(() => {}); // observed by the test, not left dangling
    loader.evict('u');
    const fresh = loader.load('u', 140);
    reject(new Error('stale'));
    await flush();
    expect(await loader.load('u', 140)).toBe(await fresh); // still cached
    expect(decode).toHaveBeenCalledTimes(2);
  });
});
