/** Decodes audio at `url` into `buckets` peak-amplitude samples, shared by Waveform and PlayerWaveform. */
export async function loadPeaks(url: string, buckets: number): Promise<number[]> {
  const ctx = new AudioContext();
  try {
    const buf = await ctx.decodeAudioData(await (await fetch(url)).arrayBuffer());
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
  } finally {
    void ctx.close();
  }
}
