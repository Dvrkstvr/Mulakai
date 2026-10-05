import type { StemKind, StemResult } from './api';
import { AudioPreview } from './AudioPreview';
import { ScoreEndsClause } from './ScoreEndsClause';
import { stemClaimLine } from './splitStemCopy';

const STEM_LABELS: Record<StemKind, string> = {
  vocals: 'Vocals',
  drums: 'Drums',
  bass: 'Bass',
  other: 'Other',
};

interface Props {
  stem: StemResult;
  layerName: string;
  nextVersion: number;
  busy: boolean;
  /** SCORE is still open for the song: a claim would end score editing (F-027). */
  scoreOpen: boolean;
  onClaim: (action: 'replace' | 'add-layer') => void;
  onReextract: () => void;
}

/** One stem's row in the dock's SPLIT — preview, status, and REPLACE/ADD LAYER/RE-EXTRACT. */
export function SplitStemRow({ stem, layerName, nextVersion, busy, scoreOpen, onClaim, onReextract }: Props) {
  const locked = !!stem.claimed;
  const ready = stem.status === 'done' && !locked && !busy;
  const claimLine = stemClaimLine(nextVersion, scoreOpen);
  const reextractable = (stem.status === 'done' || stem.status === 'failed') && !locked && !busy;

  return (
    <div className="stem-row">
      <div className="stem-row-head">
        <span className="stem-name">{STEM_LABELS[stem.kind]}</span>
      </div>
      {stem.status === 'done' && !locked && stem.audioFile && (
        <AudioPreview src={`/audio/${stem.audioFile}`} label={STEM_LABELS[stem.kind]} />
      )}
      {locked ? (
        <div className="hint">{stem.claimed === 'replaced' ? `replaced ${layerName}` : 'added as new layer'}</div>
      ) : stem.status === 'running' ? (
        <div className="hint">extracting…</div>
      ) : stem.status === 'failed' ? (
        <div className="error">{stem.error ?? 'extraction failed'}</div>
      ) : (
        <div className="hint">{claimLine.line}<ScoreEndsClause clause={claimLine.scoreEnds} /></div>
      )}
      <span className="btn-row">
        <button disabled={!ready} onClick={() => onClaim('replace')}><span>REPLACE</span></button>
        <button disabled={!ready} onClick={() => onClaim('add-layer')}><span>ADD LAYER</span></button>
        <button disabled={!reextractable} onClick={onReextract}><span>{busy ? '…' : 'RE-EXTRACT'}</span></button>
      </span>
    </div>
  );
}
