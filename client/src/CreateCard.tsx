import { AIGeneratingBackground } from './AIGeneratingBackground';
import { draftChipText, genCard } from './createBarStatus';
import { useCreateDraftStore } from './createDraftStore';
import { draftFacts } from './draftFacts';
import { useElapsedMs } from './genProgress';
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
}

/** The create bar while Create is busy (DESIGN.md "Create bar"): one card naming what Create is
 * doing, with TO CREATE as its acid end. No clear, stop or abort here — Create's CLEAR DRAFT and
 * Activity's CANCEL / ABORT do that, away from the button that opens it. */
export function CreateCardView({ label, title, facts, note, ai, failed, veil, onOpen }: CardProps) {
  return (
    <div className={ai ? 'cc ai' : failed ? 'cc failed' : 'cc'}>
      {ai && <AIGeneratingBackground progress={veil} />}
      <div className="cc-body">
        <div className="cc-line">
          <span className="cc-label">{label}</span>
          <span className="cc-title" title={title}>{title}</span>
        </div>
        {facts && facts.length > 0 && <div className="cc-facts">{facts.map((f) => <span key={f}>{f}</span>)}</div>}
        {note && <div className="cc-note">{note}</div>}
      </div>
      <button type="button" className="cc-go" onClick={onOpen}><span>TO CREATE ▸</span></button>
    </div>
  );
}

/** Quick Start writing first, then the oldest generation in flight, then the draft: whatever
 * Create is doing right now. */
export function CreateCard({ onOpen }: { onOpen: () => void }) {
  const { think, live } = useCreateBusy();
  const elapsedMs = useElapsedMs(live.length > 0, live[0]?.startedAt ?? null);
  const title = useCreateDraftStore((s) => draftChipText(s));
  const facts = useCreateDraftStore((s) => draftFacts(s).join('\u0000'));
  if (think) return <CreateCardView {...think} onOpen={onOpen} />;
  if (live.length) return <CreateCardView {...genCard(live[0], elapsedMs, live.length - 1)} onOpen={onOpen} />;
  return <CreateCardView label="DRAFT" title={title} facts={facts ? facts.split('\u0000') : []} onOpen={onOpen} />;
}
