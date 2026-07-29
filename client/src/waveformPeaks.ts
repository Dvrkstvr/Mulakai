export type PeaksDecoder = (url: string, buckets: number) => Promise<number[]>;

/**
 * URL-keyed memo around a peaks decoder. Decoding fetches and fully decodes
 * the file, so once waveforms render on every preview surface the same URL
 * would otherwise be decoded once per mount. Failures are not cached (a
 * transient fetch error stays retryable); `evict` drops every bucket size for
 * a URL — call it when revoking an object URL.
 */
export function createPeaksLoader(decode: PeaksDecoder) {
  const cache = new Map<string, Promise<number[]>>();
  return {
    load(url: string, buckets: number): Promise<number[]> {
      const key = `${url}|${buckets}`;
      const hit = cache.get(key);
      if (hit) return hit;
      const p = decode(url, buckets);
      p.catch(() => {
        if (cache.get(key) === p) cache.delete(key);
      });
      cache.set(key, p);
      return p;
    },
    evict(url: string) {
      const prefix = `${url}|`;
      for (const key of [...cache.keys()]) if (key.startsWith(prefix)) cache.delete(key);
    },
  };
}

// One context for all decodes — decodeAudioData works even while suspended,
// and creating a fresh AudioContext per call leaks OS audio handles.
let sharedCtx: AudioContext | null = null;

async function decodePeaks(url: string, buckets: number): Promise<number[]> {
  sharedCtx ??= new AudioContext();
  const buf = await sharedCtx.decodeAudioData(await (await fetch(url)).arrayBuffer());
  const data = buf.getChannelData(0);
  const per = Math.floor(data.length / buckets);
  const peaks: number[] = [];
  for (let i = 0; i < buckets; i++) {
    let max = 0;
    for (let j = i * per; j < (i + 1) * per; j += 32) {
      const v = Math.abs(data[j]);
      if (v > max) max = v;
    }
    peaks.push(max);
  }
  return peaks;
}

const loader = createPeaksLoader(decodePeaks);

/** Decodes audio at `url` into `buckets` peak-amplitude samples, shared by Waveform and PlayerWaveform. Cached per URL. */
export const loadPeaks = loader.load;

/** Drop cached peaks for a URL (all bucket sizes) — required when revoking an object URL. */
export const evictPeaks = loader.evict;
