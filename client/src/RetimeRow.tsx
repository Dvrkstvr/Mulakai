import { useReducer, useState } from 'react';
import { abcFacts } from './abcFacts';
import { BpmChip } from './BpmChip';
import { BPM_CHIP, bpmField } from './bpmField';
import { readingAbc, withRetime, withoutRetime, type CoverScore } from './coverDraft';
import { chipBlocked, dropsMany, retimeConsequence, retimeRefusal, slightHint, type RetimeChoice } from './retimeRules';
import { useRetimePreview } from './useRetimePreview';

/** RE-TIME on a transcribed score (F-091; design/retime.html A1-A7, A′; D-211, D-212): what SheetSage2 read, then
 * HALF · DOUBLE · BPM… as sky choices. Picking one rebuilds at once (no GPU), the consequence line names the
 * result, RE-TIME applies it; UNDO returns to the reading. A score whose kept reading is gone offers TRANSCRIBE AGAIN. */
export function RetimeRow({ score, onChange, onTranscribeAgain, disabled }: {
  score: CoverScore; onChange: (next: CoverScore) => void; onTranscribeAgain: () => void; disabled: boolean;
}) {
  const reading = abcFacts(readingAbc(score));
  const read = reading.bpm;
  const [mode, setMode] = useState<'half' | 'double' | null>(null);
  const [bpm, dispatch] = useReducer(bpmField, BPM_CHIP);
  const choice: RetimeChoice | null = mode ? { mode } : bpm.kind === 'locked' ? { mode: 'bpm', bpm: bpm.bpm } : null;
  const { kept, preview } = useRetimePreview(score.notationId, read, choice);
  if (!score.transcription || !read) return null;

  const pick = (m: 'half' | 'double') => { setMode(mode === m ? null : m); dispatch({ type: 'reset' }); };
  const clear = () => { setMode(null); dispatch({ type: 'reset' }); };
  const gone = kept === 'gone' || kept === 'none';
  const off = disabled || gone;
  const blocked = (['half', 'double'] as const).map((m) => chipBlocked(read, m)).filter(Boolean);
  const r = score.retime;
  return (
    <div className="retime">
      <div className="retime-row">
        <span className="section-label">READ AS</span>
        <b>{read} BPM · {reading.meter || '—'} · {reading.bars ?? '—'} BARS</b>
        {r && <span className="meta">· RE-TIMED TO {r.bpm} BPM</span>}
        <div className="dock-chips" role="radiogroup" aria-label="Re-time the score">
          {(['half', 'double'] as const).map((m) => (
            <button key={m} type="button" role="radio" aria-checked={mode === m} disabled={off || !!chipBlocked(read, m)}
              title={chipBlocked(read, m) ?? undefined} className={`tab dock-chip${mode === m ? ' active' : ''}`}
              onClick={() => pick(m)}><span>{m.toUpperCase()}</span></button>
          ))}
          <BpmChip state={bpm} disabled={off} dispatch={(e) => { if (e.type === 'open') setMode(null); dispatch(e); }} />
        </div>
      </div>
      {bpm.kind === 'open' && bpm.why && <div className="warn-note">{bpm.why} · type another, or click away to cancel</div>}
      {!gone && blocked.length > 0 && <div className="hint">{blocked.join(' · ')}</div>}
      {gone && (
        <div className="retime-gone">
          <span>{retimeRefusal('no_bundle', '')} TRANSCRIBE AGAIN reads the source from scratch on the GPU.</span>
          <button type="button" className="acid-outline" disabled={disabled} onClick={onTranscribeAgain}><span>TRANSCRIBE AGAIN</span></button>
        </div>
      )}
      {!gone && preview.status === 'slight' && choice?.mode === 'bpm' && <div className="hint">{slightHint(read, choice.bpm)}</div>}
      {!gone && preview.status === 'working' && <div className="hint">RE-TIMING… · a few seconds · no GPU</div>}
      {!gone && preview.status === 'refused' && <div className="warn-note">{retimeRefusal(preview.code, preview.message)}</div>}
      {!gone && preview.status === 'ready' && (
        <>
          <div className="retime-commit">
            <span className="hint">{retimeConsequence(reading.bars ?? 0, preview.result)}</span>
            <button type="button" className="acid-outline" disabled={disabled}
              onClick={() => { onChange(withRetime(score, preview.result, reading.bars ?? 0)); clear(); }}>
              <span>RE-TIME AT {Math.round(preview.result.bpm ?? 0)} BPM</span>
            </button>
            <button type="button" className="tag-guide-btn" onClick={clear}><span>CANCEL</span></button>
          </div>
          {dropsMany(preview.result) && (
            <div className="warn-note">
              {Math.round((preview.result.droppedNotes / preview.result.notes) * 100)} % of the notes are left out: listen to
              the cover&apos;s melody, or pick a faster tempo
            </div>
          )}
        </>
      )}
      {r && (
        <div className="retime-done">
          <span className="tag-retimed">RE-TIMED</span>
          <span className="hint">
            from {read} BPM · {r.fromBars} bars → {r.toBars}
            {r.droppedNotes ? ` · ${r.droppedNotes} of ${r.notes} notes left out` : ''} · GENERATE COVER sings this one
          </span>
          <button type="button" className="tag-guide-btn" disabled={disabled} onClick={() => onChange(withoutRetime(score))}>
            <span>UNDO</span>
          </button>
        </div>
      )}
    </div>
  );
}
