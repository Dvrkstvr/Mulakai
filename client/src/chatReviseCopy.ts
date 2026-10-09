/** The C2 edit card's own words (F-058, F-060; pipeline/design/chat-converge.html 3a-3e, 4a-4d, signed off in D-229):
 * the plan title as the card's header, the chat's SINCE and REMOVED lines, and the bar map's caption. The SCORE dock
 * keeps its own wording (`scoreReviseCopy.ts`); only the chat card reads these. Pure. */
import type { BarMap } from './api/chatConverge';
import type { ChatSplice } from './api/chatEdit';
import type { ScoreOp, ScoreOpMark, ScoreSince } from './api/score';
import { barsText } from './chatMarkLabel';

const changes = (n: number) => `${n} CHANGE${n === 1 ? '' : 'S'}`;

/** The header: `PLAN · 1 CHANGE · AGAINST BASE v4`, `PLAN 2 · REVISED FROM PLAN 1 · 2 CHANGES · AGAINST BASE v4` (the
 * dock's BASE kept, as the C0b chat spec reads it); the card a revise superseded: `PLAN 1 · REVISED BELOW`. */
export function cardTitle(revision: number | undefined, ops: number, base: number, revisedBelow = false): string {
  const rev = revision ?? 1;
  if (revisedBelow) return `PLAN ${rev} · REVISED BELOW`;
  return `${rev > 1 ? `PLAN ${rev} · REVISED FROM PLAN ${rev - 1}` : 'PLAN'} · ${changes(ops)} · AGAINST BASE v${base}`;
}
/** The superseded card's hint (3a's plan 1). */
export const SUPERSEDED_HINT = 'superseded';

/** `SINCE PLAN 1 · 1 NEW · 1 SAME · 0 REMOVED`: zero marks left out, REMOVED always said (3a, 3b). */
export function chatSinceLine(since: ScoreSince, revision: number | undefined): string {
  const count = (m: ScoreOpMark) => since.marks.filter((x) => x.mark === m).length;
  const marks = (['NEW', 'CHANGED', 'SAME'] as const).filter((m) => count(m) > 0).map((m) => `${count(m)} ${m}`);
  return [`SINCE PLAN ${(revision ?? 2) - 1}`, ...marks, `${since.removed.length} REMOVED`].join(' · ');
}
/** `REMOVED (1) · WRITE PHRASE bars 41–44 · lead line in the chorus` (3b); null when nothing was removed. */
export const chatRemovedLine = (rows: Array<{ name: string; detail: string }>) =>
  rows.length ? [`REMOVED (${rows.length})`, ...rows.map((r) => `${r.name} ${r.detail}`)].join(' · ') : null;

export const opName = (op: ScoreOp) => op.op.replace(/_/g, ' ');
const WHOLE_WORD: Partial<Record<ScoreOp['op'], string>> = { SET_TEMPO: 'TEMPO', TRANSPOSE: 'KEY', EDIT_STYLE: 'STYLE' };
const SPAN_WORDS: Partial<Record<ScoreOp['op'], string>> = {
  REHARMONIZE: 'ARE THE NEW HARMONY', WRITE_PHRASE: 'ARE THE NEW PHRASE', REPEAT: 'PLAY TWICE', CUT: 'ARE CUT', REWRITE_LYRICS: 'HAVE NEW WORDS',
};

/** The bar map's caption, worded as 3a, 4a-4d draw it: `8 OF 80 BARS CHANGE · THE OTHER 72 ARE v4`, `ALL 80 BARS CHANGE
 * (TEMPO) · BARS 49–56 ARE THE NEW HARMONY`, `WORDS CHANGE IN BARS 41–48 · THE WHOLE SONG RE-RENDERS`, `OUTRO S9 CUT · 8
 * BARS REMOVED · SEAM UN-TIED`; a hovered or focused row: `BARS 49–56 · REHARMONIZE · LIT`. Bars two ops share count once;
 * a plan that renders the whole song never claims the other bars stay. */
export function mapCaption(map: BarMap, ops: ScoreOp[], hover: number | null, s: ChatSplice, base: number): string {
  const spans = (i: number) => map.ops[i].spans.map((b) => barsText(b)).join(', ') || 'NO BARS IN THE READ';
  const lit = hover === null ? undefined : map.ops[hover];
  if (lit && ops[hover!]) return `${lit.whole ? 'WHOLE SONG' : spans(hover!)} · ${opName(ops[hover!])} · LIT`;
  const n = map.bars;
  const live = map.ops.flatMap((o, i) => (ops[i] ? [{ o, op: ops[i], i }] : []));
  const whole = live.filter((x) => x.o.whole).map((x) => WHOLE_WORD[x.op.op] ?? opName(x.op));
  const spanned = live.filter((x) => !x.o.whole && x.o.spans.length);
  if (whole.length) return [`ALL ${n} BARS CHANGE (${whole.join(', ')})`, ...spanned.map((x) => `${spans(x.i)} ${SPAN_WORDS[x.op.op] ?? opName(x.op)}`)].join(' · ');
  // A chain's merged REHARMONIZE step re-sings the gap bars between its ops too (D-265), so they count as changed.
  const merged = s.splice && s.kind === 'several' ? s.steps.filter((x) => x.kind === 'reharmonize').map((x): [number, number] => [x.from_bar, x.to_bar]) : [];
  const k = new Set([...map.ops.flatMap((o) => o.spans), ...merged].flatMap(([a, b]) => Array.from({ length: Math.max(0, b - a + 1) }, (_, j) => a + j))).size;
  if (k >= n) return `ALL ${n} BARS CHANGE`;
  const tail = s.splice ? `THE OTHER ${n - k} ARE v${base}` : 'THE WHOLE SONG RE-RENDERS';
  const only = live.length === 1 ? live[0] : null;
  if (only?.op.op === 'CUT') {
    const [a, b] = only.o.spans[0] ?? [0, -1];
    const sec = map.sections.find((x) => x.from <= a && x.to >= b);
    const name = sec ? `${sec.label.toUpperCase()}${map.sections.filter((x) => x.label === sec.label).length > 1 ? ` ${sec.occurrence}` : ''} ` : '';
    return `${name}S${only.op.section} CUT · ${k} BARS REMOVED · SEAM UN-TIED`;
  }
  if (live.length && live.every((x) => x.op.op === 'REWRITE_LYRICS')) return `WORDS CHANGE IN ${live.map((x) => spans(x.i)).join(', ')} · ${tail}`;
  return `${k} OF ${n} BARS ${live.length && live.every((x) => x.op.op === 'CUT') ? 'ARE CUT' : 'CHANGE'} · ${tail}`;
}
