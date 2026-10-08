import { useReducer, useState } from 'react';
import type { ReadingRetimeOffer } from './api/chatAnalysis';
import { BpmChip } from './BpmChip';
import { BPM_CHIP, bpmField } from './bpmField';
import {
  chipBlocked, dropsMany, readingRetimeConsequence, readingSlightHint, retimeRefusal, type RetimeChoice,
} from './retimeRules';
import { useRetimePreview } from './useRetimePreview';

const why = (err: unknown) => (err instanceof Error ? err.message : String(err));
const codeOf = (err: unknown) => (err as { code?: unknown })?.code;

/** RE-TIME on the chat reading (RT-5, F-092; design/retime.html B1-B5, D-212, D-231), under the reading line of the
 * playable version's own transcribed reading: what SheetSage2 read, HALF · DOUBLE · BPM… as sky choices; a pick
 * rebuilds at once (no GPU) so the consequence line names the bars and that a mark goes stale; RE-TIME AT n BPM
 * replaces the stored reading; UNDO returns to the reading. A reading whose kept outputs are gone offers TRANSCRIBE
 * AGAIN. The cover panel's controls and rules (`RetimeRow`) reused; the chat's buttons. */
export function ChatRetimeRow({ offer, number, onRetime, onUndo, onAgain }: {
  offer: ReadingRetimeOffer; number: number | null;
  onRetime: (choice: RetimeChoice) => Promise<void>; onUndo: () => Promise<void>; onAgain: () => Promise<void>;
}) {
  const read = offer.read.bpm;
  const [mode, setMode] = useState<'half' | 'double' | null>(null);
  const [bpm, dispatch] = useReducer(bpmField, BPM_CHIP);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const choice: RetimeChoice | null = mode ? { mode } : bpm.kind === 'locked' ? { mode: 'bpm', bpm: bpm.bpm } : null;
  const { kept, preview } = useRetimePreview(offer.notationId, read, choice);

  const clear = () => { setMode(null); dispatch({ type: 'reset' }); };
  const pick = (m: 'half' | 'double') => { setFailed(null); setMode(mode === m ? null : m); dispatch({ type: 'reset' }); };
  const run = async (act: () => Promise<void>, gone = false) => {
    setBusy(true);
    setFailed(null);
    try {
      await act();
      clear();
    } catch (err) {
      setFailed(gone || codeOf(err) !== 'no_bundle' ? why(err) : retimeRefusal('no_bundle', ''));
    } finally {
      setBusy(false);
    }
  };
  const gone = kept === 'gone' || kept === 'none';
  const off = busy || gone;
  const v = number === null ? 'this version' : `v${number}`;
  const r = offer.retimed;
  return (
    <div className="retime chat-rt" aria-label="Re-time the reading">
      <div className="retime-row">
        <span className="chat-lb">READ AS</span>
        <b>{read} BPM · {offer.read.bars} BARS</b>
        {r && <span className="chat-hn">· RE-TIMED TO {r.bpm} BPM</span>}
        <div className="dock-chips" role="radiogroup" aria-label="Re-time the score">
          {(['half', 'double'] as const).map((m) => (
            <button key={m} type="button" role="radio" aria-checked={mode === m} disabled={off || !!chipBlocked(read, m)}
              title={chipBlocked(read, m) ?? undefined} className={`tab dock-chip${mode === m ? ' active' : ''}`}
              onClick={() => pick(m)}><span>{m.toUpperCase()}</span></button>
          ))}
          <BpmChip state={bpm} disabled={off} dispatch={(e) => { if (e.type === 'open') { setMode(null); setFailed(null); } dispatch(e); }} />
        </div>
      </div>
      {bpm.kind === 'open' && bpm.why && <div className="chat-hn chat-rt-bad">{bpm.why} · type another, or click away to cancel</div>}
      {gone && (
        <div className="retime-gone">
          <span>{retimeRefusal('no_bundle', '')} TRANSCRIBE AGAIN reads {v} again from scratch on the GPU: the reading is replaced and a mark on this version goes stale.</span>
          <button type="button" className="chat-ao" disabled={busy} onClick={() => void run(onAgain, true)}><span>TRANSCRIBE AGAIN</span></button>
        </div>
      )}
      {busy && !gone && <div className="chat-hn">RE-TIMING {v.toUpperCase()} · SCORE · a few seconds</div>}
      {!busy && !gone && preview.status === 'slight' && choice?.mode === 'bpm' && <div className="chat-hn">{readingSlightHint(read, choice.bpm)}</div>}
      {!busy && !gone && preview.status === 'working' && <div className="chat-hn">RE-TIMING… · a few seconds · no GPU</div>}
      {!busy && !gone && preview.status === 'refused' && <div className="chat-hn chat-rt-bad">{retimeRefusal(preview.code, preview.message)}</div>}
      {!busy && !gone && preview.status === 'ready' && (
        <>
          <div className="retime-commit">
            <span className="chat-hn">{readingRetimeConsequence(offer.read.bars, preview.result)}</span>
            <button type="button" className="chat-ao" onClick={() => void run(() => onRetime(choice!))}>
              <span>RE-TIME AT {Math.round(preview.result.bpm ?? 0)} BPM</span>
            </button>
            <button type="button" className="chat-q" onClick={clear}><span>CANCEL</span></button>
          </div>
          {dropsMany(preview.result) && (
            <div className="chat-hn chat-rt-bad">
              {Math.round((preview.result.droppedNotes / preview.result.notes) * 100)} % of the notes are left out of the score: the bars
              still count right, the melody in them is thinner
            </div>
          )}
        </>
      )}
      {failed && <div className="chat-hn chat-rt-bad">COULD NOT RE-TIME · {failed} · nothing changed</div>}
      {r && !busy && (
        <div className="retime-done">
          <span className="tag-retimed">RE-TIMED</span>
          <span className="chat-hn">
            from {r.fromBpm} BPM · {r.fromBars} bars → {r.toBars} · same seconds, bars renumbered
            {r.droppedNotes ? ` · ${r.droppedNotes} of ${r.notes} notes left out` : ''}
          </span>
          <button type="button" className="chat-q" onClick={() => void run(onUndo)}><span>UNDO</span></button>
        </div>
      )}
    </div>
  );
}
