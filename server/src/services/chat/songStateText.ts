/**
 * Text helpers of the song-state block, ported from SP-5 prompt.py (v3.1): the run-length bar map
 * (a chord-free cover's 206 bars drop from 3.25k to 1.16k tokens), the stored style without the
 * app's own appended "NNN bpm, <key>, n/n time" hints (YuE2 does not obey them, so they can
 * contradict the score: the model read a stale 176 bpm as the tempo), and the HEADER key in words
 * (shown "K:Fm" alone, the model named the pre-TRANSPOSE key 6 of 6 times). Pure.
 */

const BAR_LINE = /^(\d+): (.*)$/;

/** Runs of identical consecutive bar lines ("n: chords | V:x | I:k") collapse to "a-b: ...";
 * section and meter lines pass through and end a run. */
export function rleBarMap(barMap: string[]): string[] {
  const parsed = barMap.map((line): [number | null, string] => {
    const m = BAR_LINE.exec(line);
    return m ? [Number(m[1]), m[2]] : [null, line];
  });
  const out: string[] = [];
  let i = 0;
  while (i < parsed.length) {
    const [n, body] = parsed[i];
    if (n === null) {
      out.push(body);
      i += 1;
      continue;
    }
    let j = i;
    while (j + 1 < parsed.length && parsed[j + 1][0] !== null && parsed[j + 1][1] === body && parsed[j + 1][0] === (parsed[j][0] as number) + 1) j += 1;
    out.push(j === i ? `${n}: ${body}` : `${n}-${parsed[j][0]}: ${body}`);
    i = j + 1;
  }
  return out;
}

const HINTS = [/^\s*\d+\s*bpm\s*$/, /^\s*[A-G][#b♭♯]?\s*(major|minor|m)?\s*$/, /^\s*\d+\/\d+\s*time\s*$/];

/** The stored style without its tempo, key and meter segments (the HEADER is the truth). */
export function cleanStyle(style: string): string {
  return style.split(', ').filter((seg) => !HINTS.some((re) => re.test(seg))).join(', ');
}

/** " (F minor)" for "Fm", " (Bb major)" for "Bb". */
export function keyWords(key: string): string {
  const minor = key.endsWith('m');
  return ` (${minor ? key.slice(0, -1) : key} ${minor ? 'minor' : 'major'})`;
}
