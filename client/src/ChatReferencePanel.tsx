/** The song panel's references (F-062, RF-6; chat-reference.html 4a): name, length, read date and origin, the rights
 * line, RE-ANALYZE with its consequence line (a new reading card, no proposal, D-129) and A/B, which flips the same
 * switch as the player's pill (`useChatAb`). No invented GPU seconds until CP-C3 calibrates them (Q-099); like the
 * READ card, "uses no GPU" when the server's estimate is 0 (a YuE2 library song, D-151 a). */
import { useState } from 'react';
import type { ReferenceView } from './api/chatReferences';
import type { AbSide } from './chatAb';
import { abReference } from './chatAb';
import { RE_ANALYZE, REFERENCE_MARK, RIGHTS_LINE, reanalyzeConsequence, referenceMeta } from './chatReferenceCopy';
import './chatReferenceSong.css';

interface Props {
  references: ReferenceView[];
  side: AbSide;
  onAb: () => void;
  /** null when the reading started, else the server's reason. */
  onReanalyze: (referenceId: string) => Promise<string | null>;
}

function Reference({ r, ab, pressed, onAb, onReanalyze }: { r: ReferenceView; ab: boolean; pressed: boolean } & Pick<Props, 'onAb' | 'onReanalyze'>) {
  const [busy, setBusy] = useState(false);
  const [refused, setRefused] = useState<string | null>(null);
  const reanalyze = async () => {
    setBusy(true);
    setRefused(await onReanalyze(r.id));
    setBusy(false);
  };
  return (
    <div className="chat-fd chat-ref-panel">
      <div className="chat-lb">{REFERENCE_MARK}</div>
      <b className="chat-ref-name">{r.name}</b>
      <div className="chat-hn">{referenceMeta(r.seconds, r.readAt)} · {r.origin}</div>
      {r.readingNote && <div className="chat-fd-problem">{r.readingNote}</div>}
      <div className="chat-hn">{RIGHTS_LINE}</div>
      <div className="chat-ref-actions">
        <button type="button" className="chat-q" disabled={busy} onClick={() => void reanalyze()}><span>{RE_ANALYZE}</span></button>
        {ab && (
          <button type="button" className={`chat-ab${pressed ? ' on' : ''}`} aria-pressed={pressed} onClick={onAb}><span>A/B</span></button>
        )}
      </div>
      <div className="chat-hn">{reanalyzeConsequence(r.estimate?.total === 0 ? 0 : null)}</div>
      {refused && <div className="chat-er" role="alert"><div><b>{RE_ANALYZE} REFUSED</b> · {refused}</div></div>}
    </div>
  );
}

export function ChatReferencePanel({ references, side, onAb, onReanalyze }: Props) {
  const playing = abReference(references);
  return (
    <>
      {references.map((r) => (
        <Reference key={r.id} r={r} ab={r.id === playing?.id} pressed={side === 'reference' && r.id === playing?.id} onAb={onAb} onReanalyze={onReanalyze} />
      ))}
    </>
  );
}
