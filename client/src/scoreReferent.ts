/** "This one" for SCORE (F-032, pipeline/design/score-m2.html M2-1..M2-3): a click on the section strip or a
 * lyric line becomes the dock's pick, sent with PLAN (pinned at the press) and re-sent by REVISE. Pure.
 * Strip sections meet the score's by kind and occurrence (the k-th chorus of the strip is the score's k-th
 * chorus); lyric blocks are counted as yue-server counts them (blank-line blocks, score_lyrics.parse_blocks). */
import type { ScoreReferent, ScoreReferentInput, ScoreSection } from './api';
import type { Section } from './lyricSections';
import type { ScorePick, ScoreVerbState } from './scoreVerbTypes';

/** yue-server's tag_word: `[Verse 2]`, `Verse 1` and `verse` are all a verse. */
export const kindOf = (tagOrLabel: string) => tagOrLabel.trim().toLowerCase().split(' ')[0].replace(/^[[\]:]+|[[\]:]+$/g, '');

/** Strip section `i` as a pick: the score section of its kind and occurrence, or `missing` when the score has
 * none (the chip turns rust, PLAN holds). Null when the score's sections are not known (nothing to pick). */
export function sectionPick(strip: Section[], i: number, sections: ScoreSection[] | undefined): ScorePick | null {
  const s = strip[i];
  if (!s || !sections) return null;
  const kind = kindOf(s.label);
  const k = strip.slice(0, i + 1).filter((x) => kindOf(x.label) === kind).length;
  const at = kind ? sections.filter((x) => kindOf(x.label) === kind)[k - 1] : undefined;
  if (!at) return { kind: 'missing', label: s.label.trim() || 'this section' };
  const same = sections.filter((x) => x.label === at.label);
  return { kind: 'section', section: at.index, label: at.label, occurrence: same.indexOf(at) + 1, of: same.length, bars: [at.from_bar, at.to_bar] };
}

/** The strip segment a section pick stands on, for its sky echo; -1 for none. */
export function stripIndexOf(strip: Section[], sections: ScoreSection[] | undefined, pick: ScorePick | null): number {
  if (pick?.kind !== 'section') return -1;
  return strip.findIndex((_, i) => {
    const p = sectionPick(strip, i, sections);
    return p?.kind === 'section' && p.section === pick.section && p.label === pick.label;
  });
}

interface DraftBlock { tag: string; lines: number[] }

/** The draft's blocks: runs of non-blank lines; a `[...]` first row is the tag, the rest are its lines (as draft
 * line indexes). */
export function draftBlocks(draft: string): DraftBlock[] {
  const blocks: DraftBlock[] = [];
  let open: DraftBlock | null = null;
  draft.split('\n').forEach((row, index) => {
    const text = row.trim();
    if (!text) { open = null; return; }
    if (!open) {
      open = { tag: text.startsWith('[') ? text : '', lines: text.startsWith('[') ? [] : [index] };
      blocks.push(open);
    } else open.lines.push(index);
  });
  return blocks;
}

/** Draft line `index` as a pick: its block's number, tag and occurrence, the line within it. Null for a tag, a
 * blank line or an untagged block (the server needs a tag to find it again). */
export function linePick(draft: string, index: number): ScoreReferentInput | null {
  const blocks = draftBlocks(draft);
  const at = blocks.findIndex((b) => b.lines.includes(index));
  const b = blocks[at];
  if (!b?.tag) return null;
  const same = blocks.filter((x) => kindOf(x.tag) === kindOf(b.tag));
  const text = draft.split('\n')[index].trim();
  return { kind: 'line', block: at + 1, tag: b.tag, occurrence: same.indexOf(b) + 1, of: same.length, line: b.lines.indexOf(index) + 1, text };
}

/** The draft line a line pick stands on, for its sky echo; -1 for none. */
export function lineIndexOf(draft: string, pick: ScorePick | null): number {
  if (pick?.kind !== 'line') return -1;
  return draftBlocks(draft)[pick.block - 1]?.lines[pick.line - 1] ?? -1;
}

/** One pick, whatever its numbering's extras: the same section or the same line of the same block. */
export function samePick(a: ScorePick | ScoreReferent | null | undefined, b: ScorePick | ScoreReferent | null | undefined): boolean {
  if (!a || !b) return !a && !b;
  if (a.kind === 'section' && b.kind === 'section') return a.section === b.section && a.label === b.label && a.occurrence === b.occurrence;
  if (a.kind === 'line' && b.kind === 'line') return a.block === b.block && a.line === b.line && kindOf(a.tag) === kindOf(b.tag);
  return a.kind === 'missing' && b.kind === 'missing' && a.label === b.label;
}

/** What PLAN sends: the live pick, pinned at the press (M2-3); none = the whole song. */
export const planReferent = (s: Pick<ScoreVerbState, 'pick'>): ScoreReferentInput | null =>
  (s.pick && s.pick.kind !== 'missing' ? s.pick : null);

/** What REVISE sends: the plan's pinned referent as the server renumbered it, unless the pick was changed or
 * cleared since (D-070 c); then the pick, or the whole song. */
export function reviseReferent(s: Pick<ScoreVerbState, 'pick' | 'plan'>): ScoreReferentInput | null {
  const pinned = s.plan?.referent ?? null;
  return pinned && samePick(s.pick, pinned) ? pinned : planReferent(s);
}
