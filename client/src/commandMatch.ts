/** The command palette's matcher (PLAN.md "UI Redesign", S3.2): `query` must appear in `text`
 * as a case-insensitive subsequence. Each matched character scores 1, plus a bonus when it starts
 * a word and when it directly follows the previous match, so "av" ranks "Add layer · vocals"'s
 * word starts above a stray 'a' and 'v' inside one word. */

const WORD_START = 3;
const RUN = 2;

const isWordChar = (c: string) => /[\p{L}\p{N}]/u.test(c);
const startsWord = (text: string, i: number) => i === 0 || !isWordChar(text[i - 1]);

/** Matched positions, or null. `preferWordStarts` jumps ahead to a word-starting occurrence of
 * each character when one exists, which can strand later characters, hence the plain fallback. */
function positions(q: string, t: string, preferWordStarts: boolean): number[] | null {
  const out: number[] = [];
  let from = 0;
  for (const ch of q) {
    let at = t.indexOf(ch, from);
    if (at < 0) return null;
    if (preferWordStarts && !startsWord(t, at) && !(out.length && at === out[out.length - 1] + 1)) {
      for (let j = t.indexOf(ch, at + 1); j >= 0; j = t.indexOf(ch, j + 1)) {
        if (startsWord(t, j)) { at = j; break; }
      }
    }
    out.push(at);
    from = at + 1;
  }
  return out;
}

function score(t: string, at: number[]): number {
  return at.reduce((sum, i, k) => sum + 1 + (startsWord(t, i) ? WORD_START : 0) + (k > 0 && i === at[k - 1] + 1 ? RUN : 0), 0);
}

/** Higher is better; 0 for an empty query (everything matches); null when it doesn't match. */
export function matchScore(query: string, text: string): number | null {
  const q = query.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!q) return 0;
  const t = text.toLowerCase();
  const preferred = positions(q, t, true);
  const plain = positions(q, t, false);
  if (!plain) return null;
  return Math.max(score(t, plain), preferred ? score(t, preferred) : 0);
}
