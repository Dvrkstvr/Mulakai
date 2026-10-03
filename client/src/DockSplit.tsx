import { useEffect, useState } from 'react';
import { api, type Layer, type StemKind } from './api';
import { useEditorJobStore } from './editorJobStore';
import { fmtElapsed, useElapsedMs } from './genProgress';
import { queueSuffix, startsAfter } from './queueCopy';
import { useJobsAhead } from './queueStore';
import { previewPlayback } from './previewPlayback';
import { SplitStemRow } from './SplitStemRow';
import { useLookup } from './lookup';
import { SplitBackendTabs } from './SplitBackendTabs';
import { DockCommit } from './DockCommit';

interface Props {
  songId: string;
  layer: Layer;
  onChanged: () => Promise<void>;
}

/**
 * SPLIT — pick a backend, extract stems from the focused layer, then per-stem
 * preview/replace/add-layer/re-extract. The extraction session itself lives in editorJobStore.ts's `splitJob` slot, not
 * local state, so navigating to the Library and back (or to a different layer
 * and back) reconnects to the same stems instead of losing them. Once settled it
 * blocks nothing else; only a new split elsewhere replaces it. Stem playback goes
 * through the shared previewPlayback slot via AudioPreview.
 */
export function DockSplit({ songId, layer, onChanged }: Props) {
  const [model, setModel] = useState<'acestep' | 'demucs' | null>(null);
  const [error, setError] = useState('');
  const [busyKind, setBusyKind] = useState<StemKind | null>(null);
  const ahead = useJobsAhead();
  const splitJob = useEditorJobStore((s) => s.splitJob);
  const startSplit = useEditorJobStore((s) => s.startSplit);
  const cancelSplitJob = useEditorJobStore((s) => s.cancelSplit);
  const patchSplitStem = useEditorJobStore((s) => s.patchSplitStem);
  const mine = splitJob?.layerId === layer.id ? splitJob : null;
  const stems = mine && mine.stage !== 'failed' ? mine.stems : null; // a failed start offers GENERATE STEMS again
  const extracting = mine?.stage === 'running';
  const otherSplit = splitJob && !mine ? splitJob : null;
  // A busy GPU doesn't hold SPLIT (the server queues it). The one open split session does: a
  // start here would close another layer's session while its stems are still extracting.
  const otherExtracting = otherSplit?.stage === 'running' ? otherSplit : null;
  const elapsedMs = useElapsedMs(extracting && !mine?.queuePosition, mine?.startedAt ?? null);

  const healthLookup = useLookup(api.splitHealth);
  const health = healthLookup.data;

  useEffect(() => {
    if (model || !health) return;
    if (health.acestep) setModel('acestep');
    else if (health.demucs) setModel('demucs');
  }, [health, model]);

  const canSubmit = !!model && !!health?.[model] && !stems && !otherExtracting;

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
    if (!mine) return;
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
    <>
      <div className="dock-body split-panel">
        {!stems ? (
          <SplitBackendTabs lookup={healthLookup} model={model} onPick={setModel} />
        ) : (
          <>
            <button className="link-btn" style={{ color: 'var(--rust-text)', alignSelf: 'flex-start' }} onClick={cancel}><span>CANCEL SPLIT</span></button>
            {extracting && (
              <div className="hint">{mine?.queuePosition ? `queued · ${startsAfter(mine.queuePosition)}` : `${fmtElapsed(elapsedMs)} elapsed`}</div>
            )}
            {stems.map((stem) => (
              <SplitStemRow
                key={stem.kind}
                stem={stem}
                layerName={layer.name}
                nextVersion={nextVersion}
                busy={busyKind === stem.kind}
                onClaim={(action) => claim(stem.kind, action)}
                onReextract={() => reextract(stem.kind)}
              />
            ))}
          </>
        )}
        {(error || mine?.stage === 'failed') && <div className="error">{error || mine?.error || 'split failed'}</div>}
      </div>
      {!stems && (
        <>
          <DockCommit
            consequence={otherExtracting
              ? "one split is open at a time — another layer's stems are still extracting · CANCEL SPLIT there first, or wait for them"
              : `extracts vocals, drums, bass and other as new stems from ${layer.name.toUpperCase()}${queueSuffix(ahead)}`}
            label={`SPLIT ${layer.name.toUpperCase()}`}
            disabled={!canSubmit}
            onCommit={() => void generate()}
          />
          {!otherExtracting && otherSplit?.stage === 'done' && <div className="hint">starting closes the open split on another layer — its unclaimed stems are discarded</div>}
        </>
      )}
    </>
  );
}
