import { describe, expect, it, vi } from 'vitest';
import { BufferCache } from './bufferCache';

const buf = (n: number) => ({ duration: n }) as AudioBuffer;

describe('BufferCache', () => {
  it('decodes a URL once', async () => {
    const decode = vi.fn(async () => buf(1));
    const cache = new BufferCache(decode);
    const [a, b] = await Promise.all([cache.get('/a'), cache.get('/a')]);
    expect(a).toBe(b);
    expect(decode).toHaveBeenCalledTimes(1);
  });

  it('keeps the latest two loads', () => {
    const cache = new BufferCache(async () => buf(1));
    const load = (u: string) => { void cache.get(u); cache.retain([u]); };
    load('/a');
    load('/b');
    expect([cache.has('/a'), cache.has('/b')]).toEqual([true, true]);
    load('/c');
    expect([cache.has('/a'), cache.has('/b'), cache.has('/c')]).toEqual([false, true, true]);
  });

  it('a failed decode is retried, not cached', async () => {
    const decode = vi.fn().mockRejectedValueOnce(new Error('HTTP 500')).mockResolvedValueOnce(buf(2));
    const cache = new BufferCache(decode);
    await expect(cache.get('/a')).rejects.toThrow('HTTP 500');
    await expect(cache.get('/a')).resolves.toEqual(buf(2));
    expect(decode).toHaveBeenCalledTimes(2);
  });
});
