/** Canned audio for the fake ACE-Step: a 16-bit stereo sine WAV, built in memory. */

const SAMPLE_RATE = 48_000;
const CHANNELS = 2;

/**
 * `seconds` of a sine at `freqHz`, with a slow tremolo so the waveform has visible shape.
 * Each task gets its own frequency (see server.ts), so every version decodes differently and a
 * test can tell a repaint or a revert from the take it replaced.
 */
export function toneWav(seconds: number, freqHz: number): Buffer {
  const frames = Math.round(seconds * SAMPLE_RATE);
  const dataBytes = frames * CHANNELS * 2;
  const buf = Buffer.alloc(44 + dataBytes);
  buf.write('RIFF', 0, 'ascii');
  buf.writeUInt32LE(36 + dataBytes, 4);
  buf.write('WAVE', 8, 'ascii');
  buf.write('fmt ', 12, 'ascii');
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(CHANNELS, 22);
  buf.writeUInt32LE(SAMPLE_RATE, 24);
  buf.writeUInt32LE(SAMPLE_RATE * CHANNELS * 2, 28);
  buf.writeUInt16LE(CHANNELS * 2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36, 'ascii');
  buf.writeUInt32LE(dataBytes, 40);
  for (let i = 0; i < frames; i++) {
    const t = i / SAMPLE_RATE;
    const tremolo = 0.55 + 0.45 * Math.sin(2 * Math.PI * 0.5 * t);
    const sample = Math.round(0.4 * tremolo * Math.sin(2 * Math.PI * freqHz * t) * 32767);
    for (let c = 0; c < CHANNELS; c++) buf.writeInt16LE(sample, 44 + (i * CHANNELS + c) * 2);
  }
  return buf;
}
