/** The composer's mark chip (F-054, F-055; chat-mark.html MK-4, MK-6, MK-8): `THIS: CHORUS 2 · BARS 41–48 · 1:36–1:55`
 * in sky with ✕, dashed for a seconds-only mark, rust `· STALE` while a version moved its bars; WHAT IT SEES ▾ opens
 * the server's preview of what SEND would carry (plain rows, AS SENT ▸ the JSON, D-177), never a client-built prompt.
 * A preview the server refuses as stale turns the mark stale. `ChatMarkStale` is the thread's stale card (USE BARS,
 * CLEAR MARK). Copy is `chatMarkLabel`'s; state is `chatMarkStore`'s. */
import { useEffect, useState } from 'react';
import { MarkStaleError, chatAnalysisApi, type AnalysisView, type MarkPreview, type RangeMark, type StripSection } from './api/chatAnalysis';
import {
  AS_SENT, CLEAR_MARK, SEES_HEAD, SEES_LOADING, SEES_NOTE, USE_BARS, WHAT_IT_SEES, chipText, chipTail, seesFailed, staleChipText, staleLines,
} from './chatMarkLabel';
import { usableBars } from './chatMark';
import { useChatMarkStore } from './chatMarkStore';
import './chatMark.css';

type Seen = { kind: 'loading' } | { kind: 'ok'; preview: MarkPreview } | { kind: 'failed'; why: string };

function Sees({ threadId, mark }: { threadId: string; mark: RangeMark }) {
  const [seen, setSeen] = useState<Seen>({ kind: 'loading' });
  const [raw, setRaw] = useState(false);
  useEffect(() => {
    let live = true;
    setSeen({ kind: 'loading' });
    chatAnalysisApi.markPreview(threadId, mark).then((preview) => { if (live) setSeen({ kind: 'ok', preview }); }).catch((err: unknown) => {
      if (!live) return;
      if (err instanceof MarkStaleError) useChatMarkStore.getState().refused(threadId, err.shift);
      setSeen({ kind: 'failed', why: err instanceof Error ? err.message : String(err) });
    });
    return () => { live = false; };
  }, [threadId, mark]);
  return (
    <div className="chat-mk-sees" role="dialog" aria-label={SEES_HEAD}>
      <div className="chat-card-hd"><span className="chat-lb">{SEES_HEAD}</span><span className="chat-hn">{SEES_NOTE}</span></div>
      {seen.kind === 'loading' && <div className="chat-mk-sees-note">{SEES_LOADING}</div>}
      {seen.kind === 'failed' && <div className="chat-mk-sees-note bad">{seesFailed(seen.why)}</div>}
      {seen.kind === 'ok' && (
        <>
          {seen.preview.rows.map((r) => <div key={r.name} className="chat-fd"><div className="chat-fk">{r.name}</div><div>{r.value}</div></div>)}
          <div className="chat-card-cm">
            <span className="chat-cs" />
            <button type="button" className="chat-link" aria-expanded={raw} onClick={() => setRaw(!raw)}>{AS_SENT}</button>
          </div>
          {raw && <pre className="chat-mk-sent" aria-label="As sent">{JSON.stringify(seen.preview.sent, null, 2)}</pre>}
        </>
      )}
    </div>
  );
}

interface ChipProps {
  threadId: string;
  sections: StripSection[];
  /** A reading is on its way: a seconds-only chip says its bars wait for it. */
  reading: boolean;
}

export function ChatMarkChip({ threadId, sections, reading }: ChipProps) {
  const entry = useChatMarkStore((s) => s.byThread[threadId]);
  const [open, setOpen] = useState(false);
  useEffect(() => { if (!entry || entry.stale) setOpen(false); }, [entry]);
  if (!entry) return null;
  const { mark, stale } = entry;
  const clear = () => useChatMarkStore.getState().clear(threadId);
  // RT-5: after a re-time the old bar numbers name other sections; the stale chip then names only the bars.
  const text = stale ? staleChipText(mark, stale.reading ? [] : sections) : `${chipText(mark, sections)}${mark.bars ? '' : chipTail(reading)}`;
  return (
    <div className="chat-mk-row">
      <span className={`chat-mk-chip${stale ? ' stale' : mark.bars ? '' : ' secs'}`} aria-label="Marked"><span>{text}</span></span>
      <button type="button" className="chat-mk-x" aria-label="Clear mark" onClick={clear}>✕</button>
      {!stale && (
        <button type="button" className="chat-link chat-mk-see" aria-expanded={open} onClick={() => setOpen(!open)}>{WHAT_IT_SEES}</button>
      )}
      {open && !stale && <Sees threadId={threadId} mark={mark} />}
    </div>
  );
}

interface StaleProps {
  threadId: string;
  view: AnalysisView | null;
  /** The version the mark was made on, and the playing one. */
  was: number | null;
  now: number | null;
}

/** The thread's stale card (MK-8): what was marked, where it went if the edit said, USE BARS only then; CLEAR MARK. */
export function ChatMarkStale({ threadId, view, was, now }: StaleProps) {
  const entry = useChatMarkStore((s) => s.byThread[threadId]);
  if (!entry?.stale) return null;
  const { useBars, tempo, reading } = entry.stale;
  const [head, ...rest] = staleLines(entry.mark, was, now, useBars, !!tempo, !!reading).split(' · ');
  return (
    <div className="chat-er chat-mk-stale" role="alert">
      <div><b>{head}</b> · {rest.join(' · ')}</div>
      {useBars && (
        // USE BARS re-times the shifted bars from the new version's reading: off until that reading has bars.
        <button type="button" className="chat-ao" disabled={!usableBars(view)} onClick={() => view && useChatMarkStore.getState().useBars(threadId, view)}>
          <span>{USE_BARS(useBars)}</span>
        </button>
      )}
      <button type="button" className="chat-q" onClick={() => useChatMarkStore.getState().clear(threadId)}><span>{CLEAR_MARK}</span></button>
    </div>
  );
}
