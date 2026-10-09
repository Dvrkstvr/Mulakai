/**
 * The version card (F-048 #1, F-047 #3, D-101, chat-edit.html 3a-3e): a saved chat edit → what the card shows:
 * the label (the version row's change list), the pill vN, the length, what the splice did to which bars (or
 * that the whole song was re-rendered, and why when it was not what the edit card promised), and the version
 * before it for BACK TO / A/B. `previous` is null when there was none; `withPrevious` drops it at view time
 * once that version was deleted in the Editor (F-048 edge). A chain (C4, `splice_v: 2`) is `kind: 'several'` with its
 * spans in reading order; a `splice_v` this build does not know shows the label only. Pure.
 */
import type { SpliceRecord, SpliceRow } from '../score/scoreVersion.js';
import type { CardBody } from './chatTypes.js';

export interface VersionCardBody extends CardBody {
  /** The whole song was re-rendered (as planned, or as a fallback). */
  whole: boolean;
  splice:
    | { kind: SpliceRow['kind']; bars: [number, number]; lengthDiffS: number | null }
    | { kind: 'several'; bars: [number, number]; lengthDiffS: number | null; steps: Array<{ kind: SpliceRow['kind']; bars: [number, number] }> }
    | null;
  /** Why a planned splice was saved as the whole re-render instead (D-101); null otherwise. */
  fallback: string | null;
  previous: { versionId: string; number: number } | null;
}

export interface SavedVersion { number: number; seconds: number | null; label: string; truncated: boolean; splice?: SpliceRecord }

export function versionCard(v: SavedVersion, previous: VersionCardBody['previous']): VersionCardBody {
  const r = v.splice;
  const fallback = r?.splice_v === 1 && 'fallback' in r ? r.fallback : null;
  const one = r?.splice_v === 1 && !('fallback' in r) ? r : null;
  const chain = r?.splice_v === 2 && Array.isArray(r.steps) ? r : null;
  const steps = chain ? [...chain.steps].sort((a, b) => a.bars[0] - b.bars[0]).map((s) => ({ kind: s.kind, bars: s.bars })) : [];
  return {
    seconds: v.seconds, label: v.label, number: v.number, truncated: v.truncated, whole: !r || fallback !== null,
    splice: one ? { kind: one.kind, bars: one.bars, lengthDiffS: one.length_diff_s }
      : chain ? { kind: 'several', bars: chain.bars, lengthDiffS: chain.length_diff_s, steps } : null,
    fallback,
    previous,
  };
}

export const withPrevious = (card: VersionCardBody, exists: (versionId: string) => boolean): VersionCardBody =>
  (card.previous && !exists(card.previous.versionId) ? { ...card, previous: null } : card);

/** yue-server's `rerender` verdict in words: D-101's label for an unaligned join, else its own detail. */
export function fallbackReason(r: { reason: string | null; detail: string | null }): string {
  return r.reason === 'not_aligned' ? 'the join could not be aligned' : r.detail ?? r.reason ?? 'the splice could not be made';
}

const DID = { reharmonize: 'changed', cut: 'removed', repeat: 'repeated' } as const;
const AFTER = { reharmonize: '', cut: ' Bars after the cut are earlier.', repeat: ' Bars after the copy are later.' } as const;

/** The version message's text in the thread. */
export function versionCardText(c: VersionCardBody): string {
  const was = c.previous ? `v${c.previous.number}` : 'the old take';
  if (c.splice) {
    const spans = c.splice.kind === 'several' ? c.splice.steps : [c.splice];
    const did = spans.map((x) => `bars ${x.bars[0]}-${x.bars[1]} ${DID[x.kind]}`).join(', ');
    const after = (['cut', 'repeat'] as const).filter((k) => spans.some((x) => x.kind === k)).map((k) => AFTER[k]).join('');
    return `Saved as v${c.number}: ${did}, the rest is ${c.previous ? `${was}'s` : 'the old'} audio.${after}`;
  }
  if (!c.whole && !c.truncated) return `Saved as v${c.number}.`; // a splice record this build cannot read
  if (c.truncated) return `Saved as v${c.number}, TRUNCATED: ${c.fallback ?? 'the render stopped early'}, so the whole short render was saved.${c.previous ? ` ${was} is the full-length take.` : ''}`;
  if (c.fallback) return `Saved as v${c.number}, as the whole re-render: ${c.fallback}. Every bar sounds different from ${was}, not only the ones you asked for.`;
  return `Saved as v${c.number}: the whole song was re-rendered, every bar sounds different from ${was}.`;
}
