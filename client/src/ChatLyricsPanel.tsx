/** The lyrics panel in the song sidebar (F-056, F-057; chat-converge.html section 2, chat-lyrics.html LY-3..LY-6): no mark
 * → the section list (click marks one); a mark → only the marked part, sections under their headers with a dashed
 * break, "n more lines … not marked"; a pending REWRITE LYRICS old struck above new, outside the mark PROPOSED. Click a
 * line marks it, shift-click extends, a header marks its section, double-click plays from the line. Nothing follows
 * playback and the panel never edits words. Rows come from `chatLyricsPanel`, gestures from `chatLyricsMark`. */
import type { MouseEvent } from 'react';
import type { AnalysisView, RangeMark } from './api/chatAnalysis';
import type { PanelSection } from './api/chatConverge';
import {
  CHANGED_MARK, FAILED_TAIL, LINE_HINT, NO_LYRICS, PROPOSED, RETRY, UNTIMED_LINE, failedLine, linesText, moreLine, panelAside,
  panelName, panelTitle, partHeader,
} from './chatConvergeCopy';
import { extendMark, lineMark, playFrom, sectionMark, type LineTimes } from './chatLyricsMark';
import type { LineRow, PanelRows, PartRow } from './chatLyricsPanel';
import './chatLyrics.css';

interface Props {
  rows: PanelRows;
  view: AnalysisView | null;
  /** The thread's live mark (null: none, or stale: then nothing here marks). */
  mark: RangeMark | null;
  /** False while the mark is stale or the version is not playable: clicks do nothing. */
  markable: boolean;
  times: LineTimes | null;
  duration: number | null;
  onMark: (m: RangeMark) => void;
  onClear: () => void;
  onRetry: () => void;
  onAsk: () => void;
  /** Double-click: play from these seconds; absent = no transport reachable from the sidebar. */
  onPlay?: (seconds: number) => void;
}

function Head({ title, aside, onAside }: { title: string; aside: string; onAside?: () => void }) {
  return (
    <div className="chat-lp-hd">
      <span className="chat-lb">{title}</span>
      {onAside ? <button type="button" className="chat-link chat-lp-aside" onClick={onAside}>{aside}</button> : <span className="chat-hn">{aside}</span>}
    </div>
  );
}

export function ChatLyricsPanel(p: Props) {
  const { rows, view } = p;
  if (rows.kind === 'waiting') return <section className="chat-lp" aria-label="Lyrics"><Head title={panelTitle({ kind: 'reading', version: rows.version })} aside="" /></section>;
  if (rows.kind === 'failed') {
    const [what, ...why] = failedLine(rows.version, rows.reason).split(' · ');
    return (
      <section className="chat-lp" aria-label="Lyrics">
        <Head title={panelTitle({ kind: 'failed' })} aside={panelAside({ kind: 'failed' })} />
        <div className="chat-er chat-lp-box" role="alert"><div><b>{what}</b>{why.length ? ` · ${why.join(' · ')}` : ''}. {FAILED_TAIL}</div>
          <button type="button" className="chat-q" onClick={p.onRetry}><span>{RETRY}</span></button></div>
      </section>
    );
  }
  if (rows.kind === 'none') {
    return (
      <section className="chat-lp" aria-label="Lyrics">
        <Head title={panelTitle({ kind: 'none' })} aside={panelAside({ kind: 'none' })} />
        <div className="chat-lp-none"><b>{NO_LYRICS.title}</b><br />{rows.note ?? NO_LYRICS.body}
          <div><button type="button" className="chat-q" onClick={p.onAsk}><span>{NO_LYRICS.action}</span></button></div></div>
      </section>
    );
  }
  const all = (rows.kind === 'list' ? rows.rows.map((r) => r.section) : rows.parts.map((x) => x.section));
  const sections = view?.shown?.lyrics?.sections ?? all;
  const mark = (e: MouseEvent, target: RangeMark | null) => {
    if (!p.markable || !view || !target) return;
    const next = e.shiftKey ? extendMark(view, p.mark, target, p.duration) : target;
    if (next) p.onMark(next);
  };
  const header = (e: MouseEvent, s: PanelSection) => view && mark(e, sectionMark(view, s, p.duration));
  const reading = rows.dim;
  const title = reading ? panelTitle({ kind: 'reading', version: rows.version })
    : rows.kind === 'list' ? panelTitle({ kind: 'list', lines: rows.lines })
      : panelTitle({ kind: 'marked', parts: rows.parts.filter((x) => !x.proposed).map((x) => panelName(x.section, sections)), lines: rows.lines });
  const first = rows.kind === 'marked' ? rows.parts[0] : null;
  const aside = reading ? panelAside({ kind: 'reading' }) : rows.kind === 'list' ? panelAside({ kind: 'list' })
    : panelAside({ kind: 'marked', markedLines: rows.markedLines, of: first?.section.lines.length ?? 0 });
  const clears = !reading && rows.kind === 'marked' && rows.markedLines === null;
  return (
    <section className="chat-lp" aria-label="Lyrics">
      <Head title={title} aside={aside} onAside={clears ? p.onClear : undefined} />
      <div className={reading ? 'chat-lp-dim' : undefined}>
        {rows.kind === 'list' ? rows.rows.map((r) => (
          <button type="button" key={r.section.strip} className={`chat-lp-sr${r.count ? '' : ' none'}`} disabled={!p.markable} onClick={(e) => header(e, r.section)}>
            <b>{panelName(r.section, sections)}{r.proposed && <em className="chat-tag">{PROPOSED}</em>}</b>
            <span>{r.section.bars[0]}–{r.section.bars[1]}</span><span>{linesText(r.count)}</span><em>{r.first ?? ''}</em>
          </button>
        )) : rows.parts.map((x, i) => <Part key={x.section.strip} part={x} brk={i > 0} sections={sections} {...p} onHeader={header} onLine={mark} />)}
        {rows.note && <div className="chat-lp-ft">{rows.note}</div>}
        {rows.kind === 'marked' && !reading && <div className="chat-lp-ft">{LINE_HINT}</div>}
      </div>
    </section>
  );
}

interface PartProps extends Props {
  part: PartRow; brk: boolean; sections: PanelSection[];
  onHeader: (e: MouseEvent, s: PanelSection) => void;
  onLine: (e: MouseEvent, target: RangeMark | null) => void;
}

function Part({ part, brk, sections, view, times, duration, markable, onHeader, onLine, onPlay }: PartProps) {
  const s = part.section;
  const name = panelName(s, sections);
  const [, ...rest] = partHeader(s, sections, part.markedBars).split(' · ');
  const source = (l: LineRow) => s.lines.find((x) => x.n === l.n) ?? null;
  const click = (e: MouseEvent, l: LineRow) => {
    const line = source(l);
    if (view) onLine(e, line ? lineMark(view, s, line, times, duration) : sectionMark(view, s, duration));
  };
  const play = (l: LineRow | null) => {
    const at = playFrom(s, l && source(l), times);
    if (at !== null) onPlay?.(at);
  };
  return (
    <div className={`chat-lp-part${brk ? ' brk' : ''}${part.proposed ? ' proposed' : ''}`}>
      <button type="button" className="chat-lp-sx" disabled={!markable} onClick={(e) => onHeader(e, s)} onDoubleClick={() => play(null)}>
        <span>{name}{part.proposed && <em className="chat-tag">{PROPOSED}</em>}</span><span>{rest.join(' · ')}</span>
      </button>
      {part.lines.map((l) => (
        <div key={l.n} className="chat-lp-row">
          {l.old !== null && <div className={`chat-lp-ln old${l.marked ? ' m' : ''}`}><i /><s>{l.old}</s></div>}
          {l.text !== null && (
            <button type="button" className={`chat-lp-ln${l.marked ? ' m' : ''}${l.old !== null ? ' new' : ''}`} disabled={!markable}
              onClick={(e) => click(e, l)} onDoubleClick={() => play(l)}>
              <i>{l.old !== null ? CHANGED_MARK : l.bar ?? ''}</i><span>{l.text}</span>
            </button>
          )}
        </div>
      ))}
      {(part.untimed || part.more > 0) && <div className="chat-lp-ft in">{part.untimed ? UNTIMED_LINE : moreLine(part.more, name)}</div>}
    </div>
  );
}
