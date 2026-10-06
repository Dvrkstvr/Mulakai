/** The M2 ops' shapes for the planner (F-029..F-031): TRANSPOSE, REPEAT / CUT and REWRITE_LYRICS,
 * bounded per song from the read's facts (sections 1..N with their labels, lyric blocks 1..B with
 * their tags and occurrences). The size limits mirror yue-server's (score_edit_routes.py
 * `Transpose`, score_section_models.py): change both; sectionSchema.test.ts reads the Python source
 * to pin them. yue-server cross-checks label, tag, occurrence and the line count and refuses with
 * the numbers; this only checks the shape. Pure. */
import type { ScoreFacts } from './planTypes.js';

export const SEMITONES_MAX = 11;
export const LABEL_MAX = 40;
export const TAG_MAX = 60;
export const LINES_MAX = 32;
export const LINE_CHARS = 200;

const int = (minimum: number, maximum: number) => ({ type: 'integer', minimum, maximum });
const op = (name: string | string[], props: Record<string, unknown>) => ({
  type: 'object', additionalProperties: false, required: ['op', ...Object.keys(props)],
  properties: { op: Array.isArray(name) ? { enum: name } : { const: name }, ...props },
});

/** The song's section labels, once each, in order; unlabelled sections cannot be repeated or cut, and a
 * label past yue-server's limit would be a 422. */
export const sectionLabels = (facts: ScoreFacts): string[] =>
  [...new Set(facts.sections.map((s) => s.label).filter((l) => l && l.length <= LABEL_MAX))];
const tags = (facts: ScoreFacts): string[] => [...new Set(facts.lyric_blocks.map((b) => b.tag).filter((t) => t.length <= TAG_MAX))];
const maxOccurrence = (facts: ScoreFacts): number => Math.max(1, ...facts.lyric_blocks.map((b) => b.occurrence));

/** The M2 op shapes this song allows: no REPEAT/CUT without a labelled section, no REWRITE_LYRICS without a block. */
export function sectionOpSchemas(facts: ScoreFacts): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [op('TRANSPOSE', { semitones: int(-SEMITONES_MAX, SEMITONES_MAX) })];
  const labels = sectionLabels(facts);
  if (labels.length) out.push(op(['REPEAT', 'CUT'], { section: int(1, facts.sections.length), label: { enum: labels } }));
  if (facts.lyric_blocks.length) {
    out.push(op('REWRITE_LYRICS', {
      block: int(1, facts.lyric_blocks.length), tag: { enum: tags(facts) }, occurrence: int(1, maxOccurrence(facts)),
      lines: { type: 'array', minItems: 1, maxItems: LINES_MAX, items: { type: 'string', minLength: 1, maxLength: LINE_CHARS } },
    }));
  }
  return out;
}

const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);
const listed = (facts: ScoreFacts) => facts.sections.map((s) => `${s.index} ${s.label}`).join(', ');

/** Shape problems of one M2 op against the song; null when `o.op` is not one of them. */
export function sectionOpProblems(o: Record<string, unknown>, facts: ScoreFacts): string[] | null {
  if (o.op === 'TRANSPOSE') {
    return isInt(o.semitones) && Math.abs(o.semitones) <= SEMITONES_MAX ? []
      : [`semitones ${String(o.semitones)} is not a whole number in -${SEMITONES_MAX}..${SEMITONES_MAX}`];
  }
  if (o.op === 'REPEAT' || o.op === 'CUT') {
    const n = facts.sections.length;
    const out: string[] = [];
    if (!isInt(o.section) || o.section < 1 || o.section > n) {
      out.push(n ? `section ${String(o.section)} does not exist (sections: ${listed(facts)})` : 'the score has no sections');
    }
    if (typeof o.label !== 'string' || !sectionLabels(facts).includes(o.label)) {
      out.push(`label ${JSON.stringify(o.label)} is not a section label of this song (${sectionLabels(facts).join(', ') || 'none'})`);
    }
    return out;
  }
  if (o.op !== 'REWRITE_LYRICS') return null;
  const b = facts.lyric_blocks.length;
  const out: string[] = [];
  if (!isInt(o.block) || o.block < 1 || o.block > b) out.push(b ? `lyric block ${String(o.block)} does not exist (blocks 1-${b})` : 'the lyrics have no blocks');
  if (typeof o.tag !== 'string' || o.tag.length > TAG_MAX) out.push(`tag must be a lyric tag as LYRIC BLOCKS lists it (at most ${TAG_MAX} characters)`);
  if (!isInt(o.occurrence) || o.occurrence < 1) out.push(`occurrence ${String(o.occurrence)} must be 1 or more`);
  const lines = o.lines;
  if (!Array.isArray(lines) || lines.length < 1 || lines.length > LINES_MAX) return [...out, `lines must list 1-${LINES_MAX} lyric lines`];
  lines.forEach((l, i) => {
    if (typeof l !== 'string' || !l.trim() || l.length > LINE_CHARS) out.push(`line ${i + 1} must be 1-${LINE_CHARS} characters of lyric text`);
  });
  return out;
}
