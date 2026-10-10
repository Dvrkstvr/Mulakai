import type { ReactNode } from 'react';
import { AIGeneratingBackground } from './AIGeneratingBackground';
import { chatShown } from './chatEntry';
import { useChatStore } from './chatStore';
import { createCardKind, draftChipText, genCard, landedCard } from './createBarStatus';
import { useCreateDraftStore } from './createDraftStore';
import { draftFacts } from './draftFacts';
import { useElapsedMs } from './genProgress';
import { useLandedStore, type Landed } from './landedStore';
import { useNavigation } from './Navigation';
import { useCreateBusy } from './useCreateBusy';
import './createCard.css';

interface CardProps {
  label: string;
  title: string;
  /** Outlined fact tags (a draft) … */
  facts?: string[];
  /** … or one line of prose (writing, generating, or why it failed). */
  note?: string;
  ai?: boolean;
  failed?: boolean;
  veil?: number;
  onOpen: () => void;
  /** The card's end; TO CREATE when not given. */
  end?: ReactNode;
}

/** The create bar while Create is busy (DESIGN.md "Create bar"): one card naming what Create is
 * doing, with TO CREATE as its acid end. No clear, stop or abort here — Create's CLEAR DRAFT and
 * Activity's CANCEL / ABORT do that, away from the button that opens it. */
export function CreateCardView({ label, title, facts, note, ai, failed, veil, onOpen, end }: CardProps) {
  return (
    <div className={ai ? 'cc ai' : failed ? 'cc failed' : end ? 'cc landed' : 'cc'}>
      {ai && <AIGeneratingBackground progress={veil} />}
      <div className="cc-body">
        <div className="cc-line">
          <span className="cc-label">{label}</span>
          <span className="cc-title" title={title}>{title}</span>
        </div>
        {facts && facts.length > 0 && <div className="cc-facts">{facts.map((f) => <span key={f}>{f}</span>)}</div>}
        {note && <div className="cc-note">{note}</div>}
      </div>
      {end ?? <button type="button" className="cc-go" onClick={onOpen}><span>TO CREATE ▸</span></button>}
    </div>
  );
}

/** A take that landed: OPEN IN EDITOR, OPEN CHAT (while the chat is configured) and ✕. Each clears the card, so a held
 * draft shows again. */
function LandedEnd({ landed }: { landed: Landed }) {
  const { openEditor, openChat } = useNavigation();
  const chatOn = chatShown(useChatStore((s) => s.status));
  const dismiss = useLandedStore((s) => s.dismiss);
  const go = (open?: (songId: string) => void) => () => { dismiss(); open?.(landed.songId); };
  return (
    <div className="cc-acts">
      <button type="button" className="tab" onClick={go(openEditor)}><span>OPEN IN EDITOR</span></button>
      {chatOn && openChat && <button type="button" className="tab" onClick={go(openChat)}><span>OPEN CHAT</span></button>}
      <button type="button" className="tab dock-quiet" aria-label="Dismiss" onClick={go()}><span>✕</span></button>
    </div>
  );
}

/** Quick Start writing first, then the oldest generation in flight, then a take that landed, then the draft: whatever
 * Create is doing right now. */
export function CreateCard({ onOpen }: { onOpen: () => void }) {
  const { think, live, landed } = useCreateBusy();
  const elapsedMs = useElapsedMs(live.length > 0, live[0]?.startedAt ?? null);
  const title = useCreateDraftStore((s) => draftChipText(s));
  const facts = useCreateDraftStore((s) => draftFacts(s).join('\u0000'));
  const kind = createCardKind(think, live.length > 0, landed !== null);
  if (kind === 'think' && think) return <CreateCardView {...think} onOpen={onOpen} />;
  if (kind === 'gen') return <CreateCardView {...genCard(live[0], elapsedMs, live.length - 1)} onOpen={onOpen} />;
  if (kind === 'landed' && landed) return <CreateCardView {...landedCard(landed)} onOpen={onOpen} end={<LandedEnd landed={landed} />} />;
  return <CreateCardView label="DRAFT" title={title} facts={facts ? facts.split('\u0000') : []} onOpen={onOpen} />;
}
