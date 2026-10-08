/** The edit card (F-046, F-049; pipeline/design/chat-edit.html 1, 2, 4; EC-1..EC-4, EC-8): what the plan assumed, the
 * SCORE change list (`ScorePlanList`), the sky bar strip (option B: the span, or the full hatch for a whole song), the
 * consequence line left of APPLY (the card's one acid; its label never turns into progress). While APPLY runs: the
 * RENDERING › SPLICING › SAVING steps and one plain line with CANCEL until SAVING. Every ending without a version is
 * one rust line; stale, superseded, expired and interrupted (a restart cut APPLY) drop APPLY; done folds to one header line.
 * C1 (F-055): a plan bounded to a mark names it and the server's notes on it (clamped, whole-song op). C2 (F-058, F-060;
 * chat-converge.html 3a-3e, 4a-4d, D-229): the plan title heads the card (PLAN 2 · REVISED FROM PLAN 1 · …) over the
 * change list's NEW / CHANGED / SAME and REMOVED (n); the card it revised stays dimmed in full, REVISED BELOW, no APPLY (Q-140 A); APPLY is off while a
 * turn (a revise) runs and back when it ends (Q-144); the bar map replaces the strip when the body has one (D-215), and
 * a change-list row on hover or focus lights its bars (Q-143). */
import { useState } from 'react';
import type { ChatMessageView } from './api/chat';
import type { ChatEditBody, ChatSplice } from './api/chatEdit';
import { ChatBarMap } from './ChatEditMap';
import { supersededBody, UNDO_OFF } from './chatConvergeCopy';
import { cardTitle, mapCaption, SUPERSEDED_HINT } from './chatReviseCopy';
import type { ScorePlan } from './api/score';
import {
  APPLY, APPLY_FAILED, EDIT_EXPIRED_BODY, EDIT_EXPIRED_TITLE, EDIT_HEADER, STALE_TITLE, WHY_WHOLE,
  applyFailedBody, applyJobLine, editInterruptedBody, applySteps, cancelledLine, editConsequence, editDoneLine, editHeader, editHint, staleBody,
  stripLine,
} from './chatEditCopy';
import { stripTotal } from './chatEditView';
import { planMarkLine } from './chatMarkLabel';
import { ASK_AGAIN } from './chatCopy';
import type { CardView } from './chatScreen';
import { useChatStore } from './chatStore';
import { turnRunning } from './chatTurn';
import { ChatErrorLine, ChatJobLine, RetryButton } from './ChatTurnLine';
import { ScorePlanList } from './ScorePlanList';
import './chatReference.css';
import './chatEdit.css';

interface Props {
  message: ChatMessageView;
  view: CardView;
  /** The active version the plan was made on (v1) and the one APPLY saves (v2). */
  base: number;
  next: number;
  ahead: number;
  /** No turn open: ASK AGAIN can send. */
  canAsk: boolean;
  onApply: (proposalId: string) => void;
  onCancel: () => void;
  onAskAgain: () => void;
  /** A turn (a revise) is open, and a later card revised this one; absent = read from the chat store. */
  revising?: boolean;
  revisedBelow?: boolean;
}

/** The bars that change, on the song as read (EC-2): a sky span, or the full hatch when the whole song re-renders. */
function BarStrip({ splice, total, base }: { splice: ChatSplice; total: number; base: number }) {
  const span = splice.splice && total > 0
    ? { left: `${((splice.from_bar - 1) / total) * 100}%`, width: `${((splice.to_bar - splice.from_bar + 1) / total) * 100}%` } : null;
  return (
    <div className="chat-strip">
      <div className={span ? 'chat-strip-bar' : 'chat-strip-bar all'}><i style={span ?? undefined} /></div>
      <div className="chat-strip-nums"><span>1</span><span>{stripLine(splice, total, base)}</span><span>{total}</span></div>
    </div>
  );
}

const asPlan = (b: ChatEditBody): ScorePlan => ({
  id: b.planId, songId: '', baseVersionId: '', request: '', ops: b.ops, verdicts: b.verdicts, style: '', checks: b.checks,
  attempts: b.attempts, refusals: b.refusals, createdAt: 0, renderMode: b.renderMode, revision: b.revision, since: b.since ?? null,
});

/** A later edit card in the thread revised this one (its `since` names this plan). */
const revisedBy = (planId: string | undefined) => (m: ChatMessageView) => m.kind === 'edit' && !!planId && (m.body as ChatEditBody | null)?.since?.planId === planId;

export function ChatEditCard({ message, view, base, next, ahead, canAsk, onApply, onCancel, onAskAgain, ...known }: Props) {
  const body = message.body as ChatEditBody | null;
  const [hover, setHover] = useState<number | null>(null);
  const turnOpen = useChatStore((s) => known.revising ?? turnRunning(s.turn));
  const revisedBelow = useChatStore((s) => known.revisedBelow ?? !!s.thread?.messages.some(revisedBy(body?.planId)));
  if (!body?.splice) return null;
  if (view.kind === 'done') {
    return (
      <div className="chat-card">
        <div className="chat-card-hd"><span className="chat-lb">{EDIT_HEADER}</span><span className="chat-hn">{editDoneLine(body.splice)}</span></div>
      </div>
    );
  }
  const apply = () => message.proposalId && onApply(message.proposalId);
  const live = view.kind === 'pending' || view.kind === 'committing';
  const phase = view.kind === 'committing' ? view.phase ?? { kind: 'starting' as const } : null;
  const line = phase ? applyJobLine(phase, body.splice, next) : null;
  const step = phase?.kind === 'running' ? phase.progressText : null;
  const steps = applySteps(body.splice);
  const sup = view.kind === 'superseded';
  // D-229: a C2 card (it carries a map) is headed by its plan title while pending, or superseded by a revise; EDIT · SCORE
  // moves to the hint. Every other state keeps C0b's state header.
  const titled = !!body.map && (view.kind === 'pending' || (sup && revisedBelow));
  const cuts = body.map ? body.map.ops.flatMap((o, i) => (body.ops[i]?.op === 'CUT' ? o.spans : [])) : [];
  const applyOff = view.kind === 'committing' || turnOpen;
  const askAgain = <button type="button" className="chat-q" disabled={!canAsk} onClick={onAskAgain}><span>{ASK_AGAIN}</span></button>;
  return (
    <div className={`chat-card chat-edit${sup ? ' sup' : ''}`} aria-label="Edit proposal">
      <div className="chat-card-hd">
        <span className="chat-lb">{titled ? cardTitle(body.revision, body.ops.length, base, sup) : editHeader(view.kind)}</span>
        <span className="chat-hn">{titled ? `${EDIT_HEADER} · ${sup ? SUPERSEDED_HINT : editHint(view.kind, base, next)}` : editHint(view.kind, base, next)}</span>
      </div>
      <div className="chat-edit-body">
        {body.assumptions.length > 0 && <div className="chat-card-style">{body.assumptions.join(' · ')}</div>}
        {body.mark && <div className="chat-hn chat-edit-mark">{planMarkLine(body.mark)}</div>}
        <ScorePlanList
          plan={asPlan(body)} baseStyle={null} fromBpm={body.from?.bpm ?? null} fromKey={body.from?.key ?? null} baseVersion={base}
          onHoverRow={body.map ? setHover : undefined} chat={body.map ? { untitled: titled } : undefined}
        />
        {body.map
          ? <ChatBarMap map={body.map} hover={hover} cuts={cuts} caption={mapCaption(body.map, body.ops, hover, body.splice, base)} />
          : <BarStrip splice={body.splice} total={stripTotal(body)} base={base} />}
        {!body.splice.splice && <div className="chat-hn">{WHY_WHOLE} {body.splice.reason}</div>}
      </div>
      {line && (
        <div className="chat-edit-run">
          <div className="chat-ref-steps">
            {steps.map((s, i) => <i key={s} className={s === step ? 'on' : step && steps.indexOf(step as never) > i ? 'dn' : ''}>{s.toUpperCase()}</i>)}
          </div>
          <ChatJobLine
            title={line.title} tail={line.tail} waiting={line.waiting}
            action={<button type="button" className="chat-q" disabled={!line.cancel} onClick={onCancel}><span>CANCEL</span></button>}
          />
        </div>
      )}
      {view.kind === 'stale' && <ChatErrorLine title={STALE_TITLE} body={staleBody(view.reason)}>{askAgain}</ChatErrorLine>}
      {view.kind === 'interrupted' && <ChatErrorLine title="INTERRUPTED" body={editInterruptedBody(base)}>{askAgain}</ChatErrorLine>}
      {view.kind === 'expired' && <ChatErrorLine title={EDIT_EXPIRED_TITLE} body={EDIT_EXPIRED_BODY}>{askAgain}</ChatErrorLine>}
      {sup && <div className="chat-card-cm"><span className="chat-cs">{supersededBody(revisedBelow)}</span></div>}
      {view.kind === 'pending' && view.cancelled !== undefined && <ChatErrorLine title={cancelledLine(view.cancelled, next)} body="" />}
      {view.kind === 'pending' && view.error && (
        <ChatErrorLine title={APPLY_FAILED} body={applyFailedBody(view.error, base)}><RetryButton onClick={apply} /></ChatErrorLine>
      )}
      {live && (
        <div className="chat-card-cm">
          <span className="chat-cs">{editConsequence(body.splice, body.renderMode, base, next, view.kind === 'pending' ? ahead : 0)}</span>
          <button type="button" className="acid chat-create" disabled={applyOff} title={turnOpen ? UNDO_OFF : undefined} onClick={apply}><span>{APPLY}</span></button>
        </div>
      )}
    </div>
  );
}
