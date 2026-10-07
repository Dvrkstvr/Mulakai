/** The frozen echo on a sent message (F-055; chat-mark.html MK-7, CS-8): `MARKED · CHORUS 2 · BARS 41–48 · 1:36–1:55`
 * and the version it was on. While the bars still mean the same music (`markStale`: valid or carried) a click marks
 * it again; after a version moved them it is dashed and text only, never remapped (D-175). */
import type { AnalysisView, RangeMark, StripSection } from './api/chatAnalysis';
import { markStale } from './chatMark';
import { ECHO_REMARK, echoMoved, echoText } from './chatMarkLabel';
import { useChatMarkStore } from './chatMarkStore';
import './chatMark.css';

interface Props {
  threadId: string;
  mark: RangeMark;
  /** The version the mark was made on, and the playing one. */
  was: number | null;
  now: number | null;
  view: AnalysisView | null;
  sections: StripSection[];
}

export function ChatMarkEcho({ threadId, mark, was, now, view, sections }: Props) {
  const { text, on } = echoText(mark, was, sections);
  const valid = markStale(mark, view).kind !== 'stale';
  const note = [on, valid ? ECHO_REMARK : echoMoved(now)].filter(Boolean).join(' · ');
  if (!valid) {
    return (
      <div className="chat-mk-echo">
        <span className="chat-mk-chip frozen moved"><span>{text}</span></span>
        <span className="chat-hn">{note}</span>
      </div>
    );
  }
  return (
    <div className="chat-mk-echo">
      <button type="button" className="chat-mk-chip frozen" title={ECHO_REMARK} onClick={() => useChatMarkStore.getState().remark(threadId, mark, view)}>
        <span>{text}</span>
      </button>
      <span className="chat-hn">{note}</span>
    </div>
  );
}
