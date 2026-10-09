/** The words for a chain of splices (C4, F-069; D-263..D-266, D-270): an edit card whose `splice.kind` is `several` (2-4
 * spans) and the version it saves. Kept out of `chatEditCopy.ts` (at its cap), which delegates here. The bar map
 * (ChatEditMap) already names every span; these are the consequence, strip, phase, done and version lines. Spans are
 * said in reading order; yue-server splices them last bar first, so its stage `splicing k/N` is `steps[k-1]`. Pure. */
import type { ChatSplice, ChatSpliceKind, ChatVersionSplice } from './api/chatEdit';

export type SeveralSplice = Extract<ChatSplice, { kind: 'several' }>;
type Span = { kind: ChatSpliceKind; from_bar: number; to_bar: number };

/** F-066: a CUT / REPEAT splice copies or removes audio; only its fallback renders. */
export const NO_RENDER = 'No GPU · no render: the audio is copied or removed at the section edges';

export const isSeveral = (s: ChatSplice): s is SeveralSplice => s.splice && s.kind === 'several';
/** One render of the edited score feeds every REHARMONIZE step (D-263); a chain of CUT / REPEAT renders nothing. */
export const severalRenders = (s: SeveralSplice) => s.steps.some((st) => st.kind === 'reharmonize');
export const readingOrder = (s: SeveralSplice): Span[] => [...s.steps].sort((a, b) => a.from_bar - b.from_bar);

const barsOf = (a: number, b: number) => (a === b ? `bar ${a}` : `bars ${a}-${b}`);
const spanOf = (s: Span) => barsOf(s.from_bar, s.to_bar);
const length = (s: Span) => s.to_bar - s.from_bar + 1;
const and = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`);
/** "bars 9-16 and 41-48"; "bar 43 and bars 47-62" when a span is one bar. */
function spansWord(spans: Span[]): string {
  if (spans.every((s) => s.from_bar !== s.to_bar)) return `bars ${and(spans.map((s) => `${s.from_bar}-${s.to_bar}`))}`;
  return and(spans.map(spanOf));
}

const KINDS: ChatSpliceKind[] = ['reharmonize', 'cut', 'repeat'];
const VERB: Record<ChatSpliceKind, string> = { reharmonize: 're-sings', cut: 'cuts', repeat: 'repeats' };
/** "re-sings bars 9-16 and 41-48, cuts bars 25-32": the spans grouped by kind, in reading order. */
export function stepsClause(spans: Span[]): string {
  const steps = [...spans].sort((a, b) => a.from_bar - b.from_bar);
  return KINDS.filter((k) => steps.some((s) => s.kind === k)).map((k) => `${VERB[k]} ${spansWord(steps.filter((s) => s.kind === k))}`).join(', ');
}

/** "bars after the cut are earlier and after the copy are later", or null when every span keeps its length. */
function shiftClause(kinds: ChatSpliceKind[]): string | null {
  const parts = [kinds.includes('cut') && 'after the cut are earlier', kinds.includes('repeat') && 'after the copy are later'].filter(Boolean);
  return parts.length ? `bars ${parts.join(' and ')}` : null;
}

/** The consequence line (F-069, D-270): what the GPU does (one render, or none for CUT / REPEAT only), every span, what
 * stays the old take's audio, what moves, and the whole-song fallback (D-154: never a partial save). */
export function severalConsequence(s: SeveralSplice, base: number, next: number): string {
  const steps = readingOrder(s);
  const render = severalRenders(s);
  const shift = shiftClause(steps.map((x) => x.kind));
  return [
    render ? 'Uses the GPU, one render, a few minutes' : NO_RENDER,
    `${stepsClause(steps)}${render ? ', instruments in the re-sung bars may change' : ''}, every other bar stays v${base}'s audio`,
    shift ? `${shift}, so BACK TO v${base} will not line up there` : 'length may differ by under 0.25 s at each re-sung span',
    'if any join cannot be aligned, the whole song is re-rendered instead',
    `saves v${next}, v${base} is kept`,
  ].join(' · ');
}

const DID_STRIP: Record<ChatSpliceKind, [string, string]> = { reharmonize: ['CHANGES', 'CHANGE'], cut: ['IS CUT', 'ARE CUT'], repeat: ['PLAYS TWICE', 'PLAY TWICE'] };
/** The strip's words for cards without a bar map: `BARS 9-16 CHANGE · BARS 25-32 ARE CUT · THE OTHER 56 ARE v3`. */
export function severalStripLine(s: SeveralSplice, total: number, base: number): string {
  const steps = readingOrder(s);
  const rest = total - steps.reduce((n, x) => n + length(x), 0);
  return [...steps.map((x) => `${spanOf(x).toUpperCase()} ${DID_STRIP[x.kind][length(x) === 1 ? 0 : 1]}`), `THE OTHER ${rest} ARE v${base}`].join(' · ');
}

/** The apply phase line while splicing: `SPLICING · 2 OF 3 · BARS 9-16` once yue-server names the step. */
export function severalSplicingTitle(s: SeveralSplice, stage: string | null | undefined): string {
  const m = /^splicing (\d+)\/(\d+)$/.exec(stage ?? '');
  const step = m ? s.steps[Number(m[1]) - 1] : undefined;
  if (m && step) return `SPLICING · ${m[1]} OF ${m[2]} · ${spanOf(step).toUpperCase()}`;
  return `SPLICING · ${s.steps.length} SPANS into the old take`;
}

export const severalDoneLine = (s: SeveralSplice) => `DONE · ${readingOrder(s).map(spanOf).join(', ').toUpperCase()}`;

// The version card (a chain saved as one version, `splice_v: 2`).
type SeveralVersion = Extract<ChatVersionSplice, { kind: 'several' }>;
const versionSpans = (v: SeveralVersion): Span[] => v.steps.map((x) => ({ kind: x.kind, from_bar: x.bars[0], to_bar: x.bars[1] }));
const DID_VERSION: Record<ChatSpliceKind, string> = { reharmonize: 'changed', cut: 'removed', repeat: 'repeated' };

/** `bars 9-16 changed, bars 25-32 removed · the rest is v3's audio`, then the length and what moved. */
export function severalVersionParts(v: SeveralVersion, was: string, lengthDiff: string | null): string[] {
  const spans = versionSpans(v);
  const did = spans.map((x) => `${spanOf(x)} ${DID_VERSION[x.kind]}`).join(', ');
  return [did, `the rest is ${was}'s audio`, lengthDiff, shiftClause(spans.map((x) => x.kind))].filter((x): x is string => !!x);
}

/** Where BACK TO stops lining up (one span or a chain's, in reading order): a CUT shifts everything from its first bar,
 * a REPEAT's copy follows its last bar (yue-server splice_repeat); the earliest one wins. Null when nothing moved. */
export function shiftFoot(spans: Array<{ kind: ChatSpliceKind; bars: [number, number] }>, previous: number): string | null {
  const first = spans.find((x) => x.kind !== 'reharmonize');
  if (!first) return null;
  const where = first.kind === 'cut' ? `from bar ${first.bars[0]}` : `after bar ${first.bars[1]}`;
  return `BACK TO v${previous} plays the same seconds, which no longer line up ${where}.`;
}
