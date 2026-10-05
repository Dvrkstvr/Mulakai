/** The M2 ops' rows and consequence clauses: TRANSPOSE, REPEAT, CUT, REWRITE LYRICS (F-029..F-031;
 * pipeline/design/score-m2.html frames 10-12, M2-8, M2-9). Pure. Part of the SCORE copy (dock rule),
 * split from scoreCopy.ts by responsibility; scoreCopy.ts composes these into its rows and line.
 * Ops address the song as read (D-066 b): S<n> is the bar map's section, #n a tag's occurrence. */
import type { ScoreLyricDiff, ScoreOp, ScorePlan } from './api';

export const REQUEST = 'a request to YuE2, not a guarantee';

export type SectionOp = Extract<ScoreOp, { op: 'TRANSPOSE' | 'REPEAT' | 'CUT' | 'REWRITE_LYRICS' }>;
type Rewrite = Extract<ScoreOp, { op: 'REWRITE_LYRICS' }>;

export const isSectionOp = (op: ScoreOp): op is SectionOp =>
  op.op === 'TRANSPOSE' || op.op === 'REPEAT' || op.op === 'CUT' || op.op === 'REWRITE_LYRICS';

/** Upstream abc_tools' 30 key names (yue-server/upstream/abc_tools.py KEYS). */
const KEYS = new Set([
  'Cb', 'Gb', 'Db', 'Ab', 'Eb', 'Bb', 'F', 'C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#',
  'Abm', 'Ebm', 'Bbm', 'Fm', 'Cm', 'Gm', 'Dm', 'Am', 'Em', 'Bm', 'F#m', 'C#m', 'G#m', 'D#m', 'A#m',
]);
/** Per pitch class, the name with the fewest accidentals, sharps on a tie (score_transpose.new_key). */
const MAJOR = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const MINOR = ['Cm', 'C#m', 'Dm', 'D#m', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'Bbm', 'Bm'];
const NATURAL: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** The key `n` semitones away, named as yue-server names it; null for a key outside the 30 names. */
export function keyAfter(key: string | null, n: number): string | null {
  const m = key && KEYS.has(key) ? /^([A-G])([#b]?)(m?)$/.exec(key) : null;
  if (!m) return null;
  const pc = (((NATURAL[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + n) % 12) + 12) % 12;
  return (m[3] ? MINOR : MAJOR)[pc];
}

const way = (n: number) => (n < 0 ? 'down' : 'up');
const semitones = (n: number) => `${way(n)} ${Math.abs(n)} semitone${Math.abs(n) === 1 ? '' : 's'}`;
const sectionName = (op: { label: string; section: number }) => `${op.label} S${op.section}`;
const times = (n: number) => (n === 1 ? 'once' : n === 2 ? 'twice' : `${n} times`);

/** "[Chorus] #2": a lyric block by its tag and the tag's occurrence. */
export const blockName = (tag: string, occurrence: number) =>
  `${tag ? (tag.startsWith('[') ? tag : `[${tag}]`) : '(untagged)'} #${occurrence}`;

const FIRST_SHOWN = 32;
const quoteStart = (line: string) =>
  `“${line.length > FIRST_SHOWN ? `${line.slice(0, FIRST_SHOWN - 1).trimEnd()}…` : line}”`;

/** How many times section `op` plays once the REPEATs up to plan op `i` are applied: "×2". */
function plays(plan: ScorePlan, op: { section: number }, i: number): number {
  return 1 + plan.ops.slice(0, i + 1).filter((o) => o.op === 'REPEAT' && o.section === op.section).length;
}

/** The row for an M2 op: name, detail and tag (TRANSPOSE, REPEAT and CUT follow; new words are a request, Q-046). */
export function sectionRow(op: SectionOp, plan: ScorePlan, i: number, key: string | null) {
  if (op.op === 'TRANSPOSE') {
    const to = keyAfter(key, op.semitones);
    return { name: 'TRANSPOSE', detail: `${semitones(op.semitones)}${to ? ` · ${key} → ${to}` : ''} · whole song`, tag: 'follows' as const };
  }
  if (op.op === 'REWRITE_LYRICS') {
    return { name: 'REWRITE LYRICS', detail: rewriteDetail(op, plan.verdicts[i]?.diff ?? null), tag: 'a request' as const };
  }
  const what = op.op === 'REPEAT' ? `×${plays(plan, op, i)}` : '· removed';
  return { name: op.op, detail: `${sectionName(op).toUpperCase()} ${what} · seam un-tied`, tag: 'follows' as const };
}

/** "[Chorus] #2 · starts “Hold the light” · 4 lines": names the block before apply (F-031 #2, M2-8). */
function rewriteDetail(op: Rewrite, diff: ScoreLyricDiff | null): string {
  const first = diff?.old[0] ? ` · starts ${quoteStart(diff.old[0])}` : '';
  return `${blockName(diff?.tag ?? op.tag, diff?.occurrence ?? op.occurrence)}${first} · ${op.lines.length} line${op.lines.length === 1 ? '' : 's'}`;
}

export interface DiffRow { changed: boolean; old: string; new: string }

/** The OLD / NEW columns, line by line (the line count is kept, so they align). */
export function diffRows(diff: ScoreLyricDiff): DiffRow[] {
  return Array.from({ length: Math.max(diff.old.length, diff.new.length) }, (_, i) => {
    const before = diff.old[i] ?? '', after = diff.new[i] ?? '';
    return { changed: before.trim() !== after.trim(), old: before, new: after };
  });
}

/** Under the diff: what changes, and that new words mean the whole song re-renders (F-031 #3). */
export function diffNote(diff: ScoreLyricDiff, baseVersion: number | null | undefined): string {
  const rows = diffRows(diff);
  const tag = blockName(diff.tag, diff.occurrence).replace(/ #\d+$/, '');
  const kind = tag.replace(/[[\]]/g, '').split(' ')[0].toLowerCase() || 'block';
  const keeps = baseVersion ? ` v${baseVersion} keeps its own words.` : '';
  return `${rows.filter((r) => r.changed).length} of ${rows.length} lines change · line count and ${tag} tag kept · `
    + `New words change what is sung, so YuE2 re-renders the whole song, not just this ${kind}.${keeps}`;
}

const applied = (plan: ScorePlan) => plan.ops.filter((_, i) => plan.verdicts[i]?.ok !== false);

/** "the key follows Gm (down 2)" and "structure follows: chorus S3 repeats once, outro S4 is cut". */
export function followClauses(plan: ScorePlan, key: string | null): string[] {
  const ops = applied(plan);
  const out: string[] = [];
  for (const op of ops) {
    if (op.op !== 'TRANSPOSE') continue;
    const to = keyAfter(key, op.semitones);
    out.push(to ? `the key follows ${to} (${way(op.semitones)} ${Math.abs(op.semitones)})` : `the key follows, ${semitones(op.semitones)}`);
  }
  const structure: string[] = [];
  const repeats = new Map<number, number>();
  for (const op of ops) if (op.op === 'REPEAT') repeats.set(op.section, (repeats.get(op.section) ?? 0) + 1);
  const said = new Set<number>();
  for (const op of ops) {
    if (op.op === 'CUT') structure.push(`${sectionName(op)} is cut`);
    if (op.op !== 'REPEAT' || said.has(op.section)) continue;
    said.add(op.section);
    structure.push(`${sectionName(op)} repeats ${times(repeats.get(op.section)!)}`);
  }
  if (structure.length) out.push(`structure follows: ${structure.join(', ')}`);
  return out;
}

/** "the new words in [Chorus] #2 are a request to YuE2, not a guarantee" (Q-046). */
export const wordClauses = (plan: ScorePlan): string[] =>
  applied(plan).flatMap((op) => (op.op === 'REWRITE_LYRICS' ? [`the new words in ${blockName(op.tag, op.occurrence)} are ${REQUEST}`] : []));
