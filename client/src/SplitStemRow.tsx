import type { StemKind, StemResult } from './api';
import { AudioPreview } from './AudioPreview';

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
  reextractBlocked: boolean;
  onClaim: (action: 'replace' | 'add-layer') => void;
  onReextract: () => void;
}

/** One stem's row in SplitPanel — preview, status, and REPLACE/ADD LAYER/RE-EXTRACT. */
export function SplitStemRow({ stem, layerName, nextVersion, busy, reextractBlocked, onClaim, onReextract }: Props) {
  const locked = !!stem.claimed;
  const ready = stem.status === 'done' && !locked && !busy;
  const reextractable = (stem.status === 'done' || stem.status === 'failed') && !locked && !busy && !reextractBlocked;

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
        <div className="hint">replace will save as v{nextVersion} · add will create a new layer</div>
      )}
      <span className="btn-row">
        <button disabled={!ready} onClick={() => onClaim('replace')}><span>REPLACE</span></button>
        <button disabled={!ready} onClick={() => onClaim('add-layer')}><span>ADD LAYER</span></button>
        <button disabled={!reextractable} onClick={onReextract}><span>{busy ? '…' : 'RE-EXTRACT'}</span></button>
      </span>
    </div>
  );
}
