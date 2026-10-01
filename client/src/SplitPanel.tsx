import { useEffect, useState } from 'react';
import { api, type Layer, type StemKind } from './api';
import { useGenerationStore } from './generationStore';
import { isGenerating, lockHolder, waitLabel } from './generationJob';
import { useEditorJobStore, isEditorBusy } from './editorJobStore';
import { fmtElapsed, useElapsedMs } from './genProgress';
import { previewPlayback } from './previewPlayback';
import { SplitStemRow } from './SplitStemRow';
import { useLookup } from './lookup';

interface Props {
  songId: string;
  layer: Layer;
  onChanged: () => Promise<void>;
  onBack: () => void;
}

/**
 * Right-rail split view — pick a backend, extract stems, then per-stem
 * preview/replace/add-layer/re-extract. Swaps into the rail in place of
 * history (see ExportPanel.tsx for the sibling view this mirrors). The
 * extraction session itself lives in editorJobStore.ts's `splitJob` slot, not
 * local state, so navigating to the Library and back (or to a different layer
 * and back) reconnects to the same stems instead of losing them. Once settled it
 * blocks nothing else; only a new split elsewhere replaces it. Stem playback goes
 * through the shared previewPlayback slot via AudioPreview.
 */
export function SplitPanel({ songId, layer, onChanged, onBack }: Props) {
  const [model, setModel] = useState<'acestep' | 'demucs' | null>(null);
  const [error, setError] = useState('');
  const [busyKind, setBusyKind] = useState<StemKind | null>(null);
  const genRunning = useGenerationStore((s) => isGenerating(s.job));
  const otherLock = useGenerationStore((s) => s.otherLock);
  const editorJob = useEditorJobStore((s) => s.editorJob);
  const splitJob = useEditorJobStore((s) => s.splitJob);
  const startSplit = useEditorJobStore((s) => s.startSplit);
  const cancelSplitJob = useEditorJobStore((s) => s.cancelSplit);
  const patchSplitStem = useEditorJobStore((s) => s.patchSplitStem);
  const mine = splitJob?.layerId === layer.id ? splitJob : null;
  const stems = mine && mine.stage !== 'failed' ? mine.stems : null; // a failed start offers GENERATE STEMS again
  const extracting = mine?.stage === 'running';
  const otherSplit = splitJob && !mine ? splitJob : null;
  // While extracting, the lock is this split's own; otherwise anything holding it blocks a start or RE-EXTRACT.
  const busyElsewhere = !extracting && (genRunning || isEditorBusy(editorJob) || otherSplit?.stage === 'running' || !!otherLock);
  const busyBy = busyElsewhere
    ? lockHolder({ generating: genRunning, otherLock, editorJob, splitRunning: otherSplit?.stage === 'running' }) : null;
  const elapsedMs = useElapsedMs(extracting, mine?.startedAt ?? null);

  const healthLookup = useLookup(api.splitHealth);
  const health = healthLookup.data;

  useEffect(() => {
    if (model || !health) return;
    if (health.acestep) setModel('acestep');
    else if (health.demucs) setModel('demucs');
  }, [health, model]);

  const canSubmit = !!model && !!health?.[model] && !stems && !busyElsewhere;

  const generate = async () => {
    if (!canSubmit || !model) return;
    setError('');
    await startSplit(layer.id, songId, model);
  };

  const cancel = async () => {
    previewPlayback.stop();
    setError('');
    await cancelSplitJob();
  };

  const claim = async (kind: StemKind, action: 'replace' | 'add-layer') => {
    if (!mine) return;
    const current = mine.stems.find((s) => s.kind === kind);
    if (!current) return;
    setBusyKind(kind);
    setError('');
    try {
      await api.claimStem(mine.splitJobId, kind, action);
      await onChanged();
      patchSplitStem({ ...current, claimed: action === 'replace' ? 'replaced' : 'added' });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyKind(null);
    }
  };

  const reextract = async (kind: StemKind) => {
    if (!mine || busyElsewhere) return;
    setBusyKind(kind);
    setError('');
    try {
      const stem = await api.reextractStem(mine.splitJobId, kind);
      patchSplitStem(stem);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyKind(null);
    }
  };

  const nextVersion = layer.versions.length + 1;

  return (
    <div className="split-panel">
      <div className="export-head">
        <span className="section-label" style={{ margin: 0 }}>SPLIT</span>
        <button className="link-btn" onClick={onBack}><span>← HISTORY</span></button>
      </div>

      {!stems ? (
        <>
          <div className="hint">will extract vocals, drums, bass, and other as new stems from "{layer.name}"</div>
          {healthLookup.error ? (
            <div className="error">
              couldn't check split backends — {healthLookup.error} <button onClick={healthLookup.retry}>RETRY</button>
            </div>
          ) : health === null ? (
            <span className="meta">checking available backends…</span>
          ) : (
            <div className="type-tabs">
              <button
                className={`tab${model === 'acestep' ? ' active' : ''}`}
                disabled={!health.acestep}
                title={health.acestep ? undefined : 'no downloaded model supports extract — requires a Base model'}
                onClick={() => setModel('acestep')}
              >
                <span>ACE-STEP</span>
              </button>
              <button
                className={`tab${model === 'demucs' ? ' active' : ''}`}
                disabled={!health.demucs}
                title={health.demucs ? undefined : 'Demucs is not configured (DEMUCS_API_URL unset)'}
                onClick={() => setModel('demucs')}
              >
                <span>DEMUCS</span>
              </button>
            </div>
          )}
          <button className="acid" disabled={!canSubmit} onClick={generate}>
            {busyBy ? waitLabel(busyBy) : 'GENERATE STEMS'}
          </button>
          {busyElsewhere && <div className="hint">only one job can use the GPU at a time — try again once it finishes</div>}
          {!busyElsewhere && otherSplit?.stage === 'done' && <div className="hint">starting closes the open split on another layer — its unclaimed stems are discarded</div>}
        </>
      ) : (
        <>
          <button className="link-btn" style={{ color: 'var(--rust-text)' }} onClick={cancel}><span>CANCEL SPLIT</span></button>
          {extracting && <div className="hint">{fmtElapsed(elapsedMs)} elapsed</div>}
          {stems.map((stem) => (
            <SplitStemRow
              key={stem.kind}
              stem={stem}
              layerName={layer.name}
              nextVersion={nextVersion}
              busy={busyKind === stem.kind}
              reextractBlocked={busyElsewhere}
              onClaim={(action) => claim(stem.kind, action)}
              onReextract={() => reextract(stem.kind)}
            />
          ))}
        </>
      )}
      {(error || mine?.stage === 'failed') && <div className="error">{error || mine?.error || 'split failed'}</div>}
    </div>
  );
}
