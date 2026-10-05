/** "This one" for SCORE (F-032, pipeline/design/score-m2.html M2-1..M2-3): a click on the section strip or a
 * lyric line becomes the dock's pick, sent with PLAN (pinned at the press) and re-sent by REVISE. Pure.
 * Strip sections meet GET /score's `sections` by kind and occurrence (the k-th chorus of the strip is the score's
 * k-th chorus); a lyric line meets its `blocks` in scoreLinePick.ts. The score's numbering is the server's. */
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
  const occurrence = at.occurrence ?? same.indexOf(at) + 1;
  return { kind: 'section', section: at.index, label: at.label, occurrence, of: same.length, bars: [at.from_bar, at.to_bar] };
}

/** The strip segment a section pick stands on, for its sky echo; -1 for none. */
export function stripIndexOf(strip: Section[], sections: ScoreSection[] | undefined, pick: ScorePick | null): number {
  if (pick?.kind !== 'section') return -1;
  return strip.findIndex((_, i) => {
    const p = sectionPick(strip, i, sections);
    return p?.kind === 'section' && p.section === pick.section && p.label === pick.label;
  });
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
