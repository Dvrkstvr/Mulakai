import type { WordTimings } from './api';

/**
 * Aligns a version's heard words (lyrics-server's reading) to the song's own LYRICS, so the
 * Editor can time each LYRICS line without ever showing Whisper's text (PLAN.md "Editor Word
 * Timestamps", decision 3). A global alignment keeps order, which is what keeps repeated
 * choruses apart; gaps absorb ad-libs and lines that weren't sung.
 */

export interface LineSpan {
  start: number;
  end: number;
}

export interface LyricAlignment {
  /** One entry per line of the lyrics (split on '\n'): its sung span, or null for a tag
   * line, a blank line, or a line none of whose words were heard. */
  lines: (LineSpan | null)[];
  /** Share of the lyrics' words that matched a heard word, 0–1 (0 when there are none). */
  matched: number;
}

const CJK = /[぀-ヿ㐀-鿿가-힯]/u;
const MATCH_SIMILARITY = 0.6;
/** A line's heard words further apart than this were heard in two places (a repeat Whisper
 * heard twice); the cluster with more matched words is the line. */
export const LINE_GAP_SECONDS = 5;

/** Words as both sides are compared: `[tags]` dropped, lowercased, apostrophes removed,
 * other punctuation dropped; CJK split per character, since neither side spaces it. */
export function tokenize(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.replace(/\[[^\]]*\]/g, ' ').split(/\s+/)) {
    const word = raw.normalize('NFKC').toLowerCase().replace(/['’`]/g, '').replace(/[^\p{L}\p{N}]+/gu, '');
    if (!word) continue;
    if (CJK.test(word)) out.push(...word);
    else out.push(word);
  }
  return out;
}

function editDistance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diag = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const up = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = up;
    }
  }
  return row[b.length];
}

export function similarity(a: string, b: string): number {
  if (a === b) return 1;
  const longest = Math.max(a.length, b.length);
  // Too different in length to reach the threshold: skip the edit distance.
  if (Math.abs(a.length - b.length) > longest * (1 - MATCH_SIMILARITY)) return 0;
  return 1 - editDistance(a, b) / longest;
}

/** Needleman–Wunsch: for each lyrics token, the heard token it is paired with (-1 for a gap)
 * and whether that pair is a match rather than a substitution. On a tie the traceback skips
 * the later heard word, so a line Whisper heard twice pairs with its first hearing whole
 * rather than half with each. */
function pairTokens(lyric: string[], heard: string[]): { pair: Int32Array; match: Uint8Array } {
  const n = lyric.length, m = heard.length, w = m + 1;
  const score = new Float64Array((n + 1) * w);
  const step = new Uint8Array((n + 1) * w); // 0 diagonal, 1 skip a lyrics token, 2 skip a heard one
  for (let i = 1; i <= n; i++) { score[i * w] = -i; step[i * w] = 1; }
  for (let j = 1; j <= m; j++) { score[j] = -j; step[j] = 2; }
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const sim = similarity(lyric[i - 1], heard[j - 1]);
      const diag = score[(i - 1) * w + j - 1] + (sim >= MATCH_SIMILARITY ? 1 + sim : -1);
      const up = score[(i - 1) * w + j] - 1;
      const left = score[i * w + j - 1] - 1;
      const best = Math.max(diag, up, left);
      score[i * w + j] = best;
      step[i * w + j] = best === left ? 2 : best === diag ? 0 : 1;
    }
  }
  const pair = new Int32Array(n).fill(-1);
  const match = new Uint8Array(n);
  for (let i = n, j = m; i > 0 || j > 0;) {
    const s = step[i * w + j];
    if (i > 0 && j > 0 && s === 0) {
      pair[i - 1] = j - 1;
      match[i - 1] = similarity(lyric[i - 1], heard[j - 1]) >= MATCH_SIMILARITY ? 1 : 0;
      i--; j--;
    } else if (i > 0 && (j === 0 || s === 1)) i--;
    else j--;
  }
  return { pair, match };
}

export function alignLyrics(lyrics: string, timings: WordTimings): LyricAlignment {
  const heard = timings.segments.flatMap((seg) =>
    seg.words.flatMap((w) => tokenize(w.text).map((token) => ({ token, start: w.start, end: w.end }))));
  const lineTexts = lyrics.split('\n');
  const tokens: string[] = [];
  const owner: number[] = [];
  lineTexts.forEach((text, li) => {
    for (const t of tokenize(text)) { tokens.push(t); owner.push(li); }
  });

  const { pair, match } = pairTokens(tokens, heard.map((h) => h.token));
  const paired: { start: number; end: number; match: boolean }[][] = lineTexts.map(() => []);
  let matchedCount = 0;
  tokens.forEach((_, k) => {
    if (pair[k] < 0) return;
    const word = heard[pair[k]];
    // Substitutions count toward the span, so a misheard first word still anchors the start.
    paired[owner[k]].push({ start: word.start, end: word.end, match: !!match[k] });
    if (match[k]) matchedCount++;
  });
  return {
    lines: paired.map(lineSpan),
    matched: tokens.length ? matchedCount / tokens.length : 0,
  };
}

/** The span of a line's largest cluster of heard words, or null when none of them matched. */
function lineSpan(words: { start: number; end: number; match: boolean }[]): LineSpan | null {
  let best: LineSpan | null = null;
  let bestMatches = 0;
  let span: LineSpan | null = null;
  let matches = 0;
  for (const w of words) {
    if (span && w.start - span.end > LINE_GAP_SECONDS) { span = null; matches = 0; }
    span = span ? { start: span.start, end: Math.max(span.end, w.end) } : { start: w.start, end: w.end };
    if (w.match) matches++;
    if (matches > bestMatches) { best = span; bestMatches = matches; }
  }
  return best;
}
