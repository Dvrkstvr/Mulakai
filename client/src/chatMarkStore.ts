/** The mark per thread (F-054, F-055; CS-8, CS-11), in memory only: set, clear, re-mark from a sent message's echo,
 * reconcile with each new analysis view (carried, landed bars, or stale), USE BARS. A stale mark holds SEND and is
 * never sent; nothing is remapped without USE BARS. Geometry and `markStale` are `chatMark`'s. */
import { create } from 'zustand';
import type { AnalysisView, RangeMark, Shift, StripSection } from './api/chatAnalysis';
import { landBars, markBars, markStale, shiftedBars } from './chatMark';
import { markLabel } from './chatMarkLabel';

export interface MarkEntry {
  mark: RangeMark;
  /** Set when a version moved the marked bars: `useBars` only when the edit reported the shift (CS-11); `tempo` when
   * it changed the tempo instead (the same bars, at new times). */
  stale: { useBars: [number, number] | null; tempo?: true } | null;
}

interface ChatMarkStore {
  byThread: Record<string, MarkEntry>;
  set: (threadId: string, mark: RangeMark) => void;
  /** Empty click, ✕, Esc, CLEAR MARK. */
  clear: (threadId: string) => void;
  /** A new analysis view: carry the mark onto a version that moved no bars, snap a seconds-only mark when bars land,
   * or turn it stale. */
  reconcile: (threadId: string, view: AnalysisView) => void;
  /** The server answered MARK_STALE (at SEND or on the preview): stale, with USE BARS when its shift maps the bars. */
  refused: (threadId: string, shift: Shift | null) => void;
  /** USE BARS: the shifted bars on the playable version, re-timed from its reading; false (nothing changes) until
   * that reading has bars. */
  useBars: (threadId: string, view: AnalysisView) => boolean;
  /** Click a frozen echo: re-mark it while it still fits; false when it is stale (nothing changes). */
  remark: (threadId: string, sent: RangeMark, view: AnalysisView | null) => boolean;
}

export const useChatMarkStore = create<ChatMarkStore>((set, get) => {
  const put = (threadId: string, entry: MarkEntry | null) => set((s) => {
    const byThread = { ...s.byThread };
    if (entry) byThread[threadId] = entry;
    else delete byThread[threadId];
    return { byThread };
  });

  return {
    byThread: {},
    set: (threadId, mark) => put(threadId, { mark, stale: null }),
    clear: (threadId) => put(threadId, null),

    reconcile: (threadId, view) => {
      const entry = get().byThread[threadId];
      if (!entry || entry.stale) return;
      const fit = markStale(entry.mark, view);
      if (fit.kind === 'stale') return put(threadId, { mark: entry.mark, stale: { useBars: fit.useBars, ...(fit.tempo ? { tempo: true } : {}) } });
      const mark = landBars(view, fit.kind === 'carried' ? fit.mark : entry.mark);
      if (mark !== entry.mark) put(threadId, { mark, stale: null });
    },

    refused: (threadId, shift) => {
      const entry = get().byThread[threadId];
      if (!entry) return;
      const useBars = entry.mark.bars && shift ? shiftedBars(entry.mark.bars, shift) : null;
      put(threadId, { mark: entry.mark, stale: { useBars } });
    },

    useBars: (threadId, view) => {
      const bars = get().byThread[threadId]?.stale?.useBars;
      const mark = bars ? markBars(view, bars[0], bars[1]) : null;
      if (mark) put(threadId, { mark, stale: null });
      return !!mark;
    },

    remark: (threadId, sent, view) => {
      const fit = markStale(sent, view);
      if (fit.kind === 'stale') return false;
      const { kind, versionId, bars, seconds } = fit.kind === 'carried' ? fit.mark : sent;
      put(threadId, { mark: { kind, versionId, seconds, ...(bars ? { bars } : {}) }, stale: null });
      return true;
    },
  };
});

/** What SEND carries: the thread's mark, or nothing (no mark = the whole song, F-055 edge). `sections`: the strip it
 * was made on, so the frozen echo keeps the chip's label (`label`, display only; the server never trusts it). */
export const markToSend = (threadId: string | undefined, sections?: StripSection[]): RangeMark | null => {
  const e = threadId ? useChatMarkStore.getState().byThread[threadId] : undefined;
  if (!e || e.stale) return null;
  return sections ? { ...e.mark, label: markLabel(e.mark, sections) } : e.mark;
};
/** A stale mark holds SEND until USE BARS or CLEAR MARK (CS-11). */
export const markHoldsSend = (threadId: string | undefined): boolean =>
  !!threadId && !!useChatMarkStore.getState().byThread[threadId]?.stale;
