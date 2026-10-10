/** Decoded audio by URL for live playback. A take switch (USE, an A/B alt-click, BACK) changes one layer's URL, so
 * the other layers, and the take switched away from, come back without a refetch or redecode. Only the URLs of the
 * latest two loads are kept: a decoded song is tens of MB. */
export class BufferCache {
  private entries = new Map<string, Promise<AudioBuffer>>();
  private previous: string[] = [];
  private decode: (url: string) => Promise<AudioBuffer>;

  constructor(decode: (url: string) => Promise<AudioBuffer>) {
    this.decode = decode;
  }

  get(url: string): Promise<AudioBuffer> {
    let entry = this.entries.get(url);
    if (!entry) {
      const fresh = this.decode(url);
      entry = fresh;
      this.entries.set(url, fresh);
      // A failed fetch or decode is retried on the next load, not cached.
      fresh.catch(() => { if (this.entries.get(url) === fresh) this.entries.delete(url); });
    }
    return entry;
  }

  /** The load of these URLs is now current: drop everything outside it and the load before. */
  retain(urls: string[]) {
    const keep = new Set([...urls, ...this.previous]);
    for (const url of [...this.entries.keys()]) if (!keep.has(url)) this.entries.delete(url);
    this.previous = urls;
  }

  has(url: string): boolean {
    return this.entries.has(url);
  }
}
