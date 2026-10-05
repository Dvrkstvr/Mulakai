/** SCORE's "this one" copy (F-032; pipeline/design/score-m2.html frames 1-4, M2-1..M2-4): the chip's sky suffix,
 * its hint, the placeholder and asking clause, the plan header's FOR, the moved-on note and the stale
 * selection. Pure. Part of the SCORE copy (dock rule), re-exported by scoreCopy.ts. */
import type { ScorePlan, ScoreReferent, ScoreStaleReferent } from './api';
import { fmtRange, type DockTarget } from './dockTarget';
import { samePick } from './scoreReferent';
import type { ScorePick, ScoreVerbState } from './scoreVerbTypes';
import type { Region } from './Waveform';

type Named = ScorePick | ScoreReferent;
const QUOTE_MAX = 40;
const clip = (t: string) => (t.length > QUOTE_MAX ? `${t.slice(0, QUOTE_MAX - 1).trimEnd()}…` : t);
const tagName = (tag: string) => (tag.startsWith('[') ? tag : `[${tag}]`);

export const barsOf = (bars: [number, number]) => (bars[0] === bars[1] ? `bar ${bars[0]}` : `bars ${bars[0]}–${bars[1]}`);
const barsIn = (r: Named): [number, number] | null => ('bars' in r ? r.bars ?? null : null);

/** "CHORUS 2" (the occurrence only when the label repeats), "LINE 2 OF [CHORUS] #2", "SPOKEN INTRO". */
export function referentName(r: Named): string {
  if (r.kind === 'missing') return r.label.toUpperCase();
  if (r.kind === 'section') return `${r.label.toUpperCase()}${r.of === 1 ? '' : ` ${r.occurrence}`}`;
  return `LINE ${r.line} OF ${tagName(r.tag).toUpperCase()} #${r.occurrence}`;
}

/** The chip's words for a pick: a line (or a line the score lacks) by its quoted words, a section by its name. */
const quoted = (r: Named) => (r.kind === 'line' ? r.text : r.kind === 'missing' && r.line ? r.label : null);
const chipName = (r: Named) => { const t = quoted(r); return t ? `“${clip(t).toUpperCase()}”` : referentName(r); };

export const WHOLE_SCORE = 'BASE · WHOLE SCORE';
export const CLEAR_PICK = '✕ WHOLE SCORE';
/** The stale line's quiet way out: the whole song. */
export const WHOLE_SCORE_PICK = 'WHOLE SCORE';
const NO_PICK_HINT = 'click a section or a lyric line: it becomes “this” in your request';

/** The SCORE chip (M2-1): `BASE · WHOLE SCORE · THIS: CHORUS 2 · BARS 29–36`, rust for a section or lyric line
 * the score lacks, or a stale pick; `clearable` offers ✕ WHOLE SCORE. A dragged range is not a pick: the hint says so (M2-2). */
export function scoreTarget(s: Pick<ScoreVerbState, 'pick' | 'stale'>, selection: Region | null): DockTarget {
  const pick = s.pick;
  if (!pick) {
    const hint = selection ? `SCORE takes a section or a lyric line · the range ${fmtRange(selection)} is ignored` : NO_PICK_HINT;
    return { label: WHOLE_SCORE, warn: false, clearable: false, hint, section: null };
  }
  const stale = !!s.stale && samePick(pick, s.stale.picked);
  const name = chipName(pick);
  const bars = barsIn(pick);
  const suffix = pick.kind === 'missing' ? `${name} · NOT IN THE SCORE` : stale ? `${name} · STALE` : bars && pick.kind === 'section' ? `${name} · ${barsOf(bars).toUpperCase()}` : name;
  const hint = pick.kind === 'missing' ? (pick.line ? 'the score’s lyrics have no such line here · pick another or ✕ clear it' : 'pick another section or ✕ clear it')
    : stale ? 'the score changed since this was picked'
      : pick.kind === 'line' ? `line ${pick.line} of ${tagName(pick.tag)} #${pick.occurrence}${bars ? ` · ${barsOf(bars)}` : ''} · ✕ clears it`
        : `“this” means ${name} · ✕ clears it`;
  return { label: `${WHOLE_SCORE} · THIS: ${suffix}`, warn: pick.kind === 'missing' || stale, clearable: true, hint, section: null };
}

/** The field's placeholder with a pick (frame 2). */
export const pickPlaceholder = (pick: ScorePick | null, fallback: string) =>
  (pick && pick.kind !== 'missing' ? `Describe the change to ${referentName(pick)}, e.g. make this jazzier` : fallback);

/** The asking line's clause with a pick: ` · “this” means CHORUS 2, bars 29–36` (frame 2). */
export function askingClause(pick: ScorePick | null): string {
  if (!pick || pick.kind === 'missing') return '';
  const bars = barsIn(pick);
  return ` · “this” means ${referentName(pick)}${bars ? `, ${barsOf(bars)}` : ''}`;
}

/** The plan header's ` · FOR CHORUS 2 (BARS 29–36)` (M2-3); nothing for the whole song. */
export function forClause(r: ScoreReferent | null | undefined): string {
  if (!r) return '';
  const bars = barsIn(r);
  return ` · FOR ${referentName(r)}${bars ? ` (${barsOf(bars).toUpperCase()})` : ''}`;
}

const nameOrWhole = (r: Named | null | undefined) => (r ? referentName(r) : 'THE WHOLE SCORE');

/** Frame 3: the pick moved on after PLAN; the plan keeps what it was made for. Null while they agree. */
export function movedOnNote(plan: ScorePlan, pick: ScorePick | null): string | null {
  if (samePick(plan.referent ?? null, pick)) return null;
  const made = nameOrWhole(plan.referent);
  return `planned for ${made}, the selection is now ${nameOrWhole(pick)} · APPLY uses ${made}`;
}

export const STALE_SELECTION = 'STALE SELECTION';

/** The rejected row (M2-4): what was picked, never planned. */
export const staleRow = (stale: ScoreStaleReferent) =>
  `${referentName(stale.picked)} · not planned: the selection is stale`;

/** Frame 4's rust line: where the pick was, why it is stale, and that nothing was applied. */
export function staleBody(stale: ScoreStaleReferent): string {
  const bars = barsIn(stale.picked);
  return `you picked ${referentName(stale.picked)}${bars ? `, ${barsOf(bars)}` : ''} · ${stale.reason} · Nothing was applied.`;
}

/** USE BARS 37–44 re-picks `now` (Q-043); null when the pick is gone. */
export function repickLabel(stale: ScoreStaleReferent): string | null {
  const now = stale.now;
  if (!now) return null;
  return now.bars ? `USE ${barsOf(now.bars).toUpperCase()}` : `USE ${referentName(now)}`;
}
