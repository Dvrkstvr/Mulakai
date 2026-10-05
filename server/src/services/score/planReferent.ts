/** "This one" for the planner (F-032): a picked strip section or lyric line, checked against the score as
 * read when PLAN runs. A pick that still matches is pinned and told to the planner as THIS with its bars; one
 * that no longer matches (a render moved or removed it) is stale and is never planned against: it names where
 * the same label + occurrence lives now, for USE BARS (Q-043, M2-4), counted from the end when the pick says
 * how many there were. A line means its block and the section that sings it (Q-045), by yue-server's rule:
 * the k-th section of a kind sings the k-th block of that kind (D-066 d; kind = the tag's first word). Pure. */
import type { LyricBlock, Referent, ReferentInput, ScoreFacts, ScoreSection, StaleReferent } from './planTypes.js';

const TEXT_MAX = 200;
const LABEL_MAX = 60;
const BAD = 'referent must be a picked section or lyric line';

export type ParsedReferent = { ok: true; referent: ReferentInput | null } | { ok: false; error: string };
export type ResolvedReferent = { ok: true; referent: Referent } | { ok: false; stale: StaleReferent };

const isPos = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 1;
const isName = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0 && v.length <= LABEL_MAX;
/** yue-server's tag_word: `[Verse 2]` and `verse` are both a verse. */
const kindOf = (tagOrLabel: string) => tagOrLabel.toLowerCase().split(' ')[0].replace(/^[[\]:]+|[[\]:]+$/g, '');

/** The request body's `referent`: absent or null = the whole song. */
export function parseReferent(v: unknown): ParsedReferent {
  if (v === undefined || v === null) return { ok: true, referent: null };
  if (typeof v !== 'object' || Array.isArray(v)) return { ok: false, error: BAD };
  const o = v as Record<string, unknown>;
  const of = isPos(o.of) && isPos(o.occurrence) && o.of >= o.occurrence ? { of: o.of } : {};
  if (o.of !== undefined && !('of' in of)) return { ok: false, error: 'referent.of must be at least its occurrence' };
  if (o.kind === 'section') {
    const bars = o.bars;
    if (!isPos(o.section) || !isName(o.label) || !isPos(o.occurrence) || !Array.isArray(bars) || bars.length !== 2
      || !isPos(bars[0]) || !isPos(bars[1]) || bars[1] < bars[0]) {
      return { ok: false, error: 'a picked section needs {section, label, occurrence, bars: [from, to]}' };
    }
    return { ok: true, referent: { kind: 'section', section: o.section, label: o.label, occurrence: o.occurrence, ...of, bars: [bars[0], bars[1]] } };
  }
  if (o.kind === 'line') {
    if (!isPos(o.block) || !isName(o.tag) || !isPos(o.occurrence) || !isPos(o.line)) {
      return { ok: false, error: 'a picked lyric line needs {block, tag, occurrence, line}' };
    }
    const text = typeof o.text === 'string' && o.text.trim() ? o.text.trim().replace(/\s+/g, ' ').slice(0, TEXT_MAX) : undefined;
    return { ok: true, referent: { kind: 'line', block: o.block, tag: o.tag, occurrence: o.occurrence, ...of, line: o.line, ...(text ? { text } : {}) } };
  }
  return { ok: false, error: BAD };
}

/** The picked occurrence among `list` now: counted from the end when the pick says how many there were. */
const locate = <T>(list: T[], occurrence: number, of?: number): T | undefined =>
  (of ? list[list.length - 1 - (of - occurrence)] : list[occurrence - 1]);
const sameLabel = (facts: ScoreFacts, label: string) => facts.sections.filter((s) => s.label === label);
const sameKind = (facts: ScoreFacts, tag: string) => facts.lyric_blocks.filter((b) => kindOf(b.tag) === kindOf(tag));

function sectionPin(facts: ScoreFacts, s: ScoreSection): Referent {
  const all = sameLabel(facts, s.label);
  return { kind: 'section', section: s.index, label: s.label, occurrence: all.indexOf(s) + 1, of: all.length, bars: [s.from_bar, s.to_bar] };
}

function linePin(facts: ScoreFacts, b: LyricBlock, line: number, text: string | null): Referent {
  const s = facts.sections.filter((x) => kindOf(x.label) === kindOf(b.tag))[b.occurrence - 1];
  return { kind: 'line', block: b.index, tag: b.tag, occurrence: b.occurrence, of: sameKind(facts, b.tag).length, line, text,
    section: s?.index ?? null, label: s?.label ?? null, bars: s ? [s.from_bar, s.to_bar] : null };
}

/** Checks a pick against the read: a section must still be S<n> with its label and bars; a line's block must
 * still be that tag's occurrence and have the line. Otherwise it is stale, with where it is now. */
export function resolveReferent(picked: ReferentInput, facts: ScoreFacts): ResolvedReferent {
  if (picked.kind === 'section') {
    const at = facts.sections.find((s) => s.index === picked.section);
    const [from, to] = picked.bars;
    if (at && at.label === picked.label && at.from_bar === from && at.to_bar === to) return { ok: true, referent: sectionPin(facts, at) };
    const now = locate(sameLabel(facts, picked.label), picked.occurrence, picked.of);
    const name = `${picked.label} #${picked.occurrence}`;
    const reason = now ? `${name} was bars ${from}-${to} and is now bars ${now.from_bar}-${now.to_bar}` : `${name} (bars ${from}-${to}) is no longer in the score`;
    return { ok: false, stale: { picked, now: now ? sectionPin(facts, now) : null, reason } };
  }
  const text = picked.text ?? null;
  const at = facts.lyric_blocks.find((b) => b.index === picked.block);
  if (at && kindOf(at.tag) === kindOf(picked.tag) && at.occurrence === picked.occurrence && picked.line <= at.lines) {
    return { ok: true, referent: linePin(facts, at, picked.line, text) };
  }
  const now = locate(sameKind(facts, picked.tag), picked.occurrence, picked.of);
  const name = `${picked.tag} #${picked.occurrence}`;
  if (!now) return { ok: false, stale: { picked, now: null, reason: `${name} (lyric block ${picked.block}) is no longer in the lyrics` } };
  if (picked.line > now.lines) return { ok: false, stale: { picked, now: null, reason: `${name} has ${now.lines} lines now, not line ${picked.line}` } };
  return { ok: false, stale: { picked, now: linePin(facts, now, picked.line, text), reason: `${name} was lyric block ${picked.block} and is now block ${now.index}` } };
}

export const STALE_REFERENT = 'the selection is stale';
export const staleMessage = (stale: StaleReferent): string => `${STALE_REFERENT}: ${stale.reason}`;

const MEANS = '"this", "here" and "it" in the REQUEST mean';

/** The THIS line of the planner's user message; nothing for the whole song. */
export function referentLines(r: Referent | null): string[] {
  if (!r) return [];
  if (r.kind === 'section') {
    return [`THIS: ${r.label} S${r.section} (${r.label} #${r.occurrence}), bars ${r.bars[0]}-${r.bars[1]}. ${MEANS} these bars.`];
  }
  const head = `THIS: line ${r.line} of lyric block ${r.block} (${r.tag} #${r.occurrence})${r.text ? `: ${JSON.stringify(r.text)}` : ''}`;
  return [r.bars
    ? `${head}, sung in ${r.label} S${r.section}, bars ${r.bars[0]}-${r.bars[1]}. ${MEANS} this line's block and those bars.`
    : `${head}, sung in no section of the score. ${MEANS} this line's block.`];
}
