import { useEffect, useRef, useState } from 'react';
import { api, type Layer, type StemKind } from './api';
import { useGenerationStore } from './generationStore';
import { useEditorJobStore, myEditorJob } from './editorJobStore';
import { fmtElapsed, useElapsedMs } from './genProgress';
import { SplitStemRow } from './SplitStemRow';

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
 * extraction session itself lives in editorJobStore.ts, not local state, so
 * navigating to the Library and back (or to a different layer and back)
 * reconnects to the same stems instead of losing them.
 */
export function SplitPanel({ songId, layer, onChanged, onBack }: Props) {
  const [health, setHealth] = useState<{ acestep: boolean; demucs: boolean } | null>(null);
  const [model, setModel] = useState<'acestep' | 'demucs' | null>(null);
  const [error, setError] = useState('');
  const [playing, setPlaying] = useState<StemKind | null>(null);
  const [busyKind, setBusyKind] = useState<StemKind | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const genJob = useGenerationStore((s) => s.job);
  const otherLock = useGenerationStore((s) => s.otherLock);
  const editorJob = useEditorJobStore((s) => s.editorJob);
  const startSplit = useEditorJobStore((s) => s.startSplit);
  const cancelSplitJob = useEditorJobStore((s) => s.cancelSplit);
  const patchSplitStem = useEditorJobStore((s) => s.patchSplitStem);
  const mine = myEditorJob(editorJob, 'split', { layerId: layer.id });
  const stems = mine?.stems ?? null;
  const extracting = mine?.stage === 'running';
  const busyElsewhere = !mine && (!!genJob || !!editorJob || !!otherLock);
  const elapsedMs = useElapsedMs(extracting, mine?.startedAt ?? null);

  useEffect(() => {
    api.splitHealth().then(setHealth).catch(() => setHealth({ acestep: false, demucs: false }));
  }, []);

  useEffect(() => {
    if (model || !health) return;
    if (health.acestep) setModel('acestep');
    else if (health.demucs) setModel('demucs');
  }, [health, model]);

  useEffect(() => {
    const audio = audioRef.current;
    return () => audio?.pause();
  }, []);

  const canSubmit = !!model && !!health?.[model] && !mine && !busyElsewhere;

  const generate = async () => {
    if (!canSubmit || !model) return;
    setError('');
    await startSplit(layer.id, songId, model);
  };

  const cancel = async () => {
    audioRef.current?.pause();
    setPlaying(null);
    setError('');
    await cancelSplitJob();
  };

  const togglePreview = (kind: StemKind, audioFile?: string) => {
    const audio = audioRef.current;
    if (!audio || !audioFile) return;
    if (playing === kind) {
      audio.pause();
      setPlaying(null);
      return;
    }
    audio.src = `/audio/${audioFile}`;
    void audio.play();
    setPlaying(kind);
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
          {health === null ? (
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
            {busyElsewhere ? 'BUSY ELSEWHERE' : 'GENERATE STEMS'}
          </button>
          {busyElsewhere && <div className="hint">a generation is already running elsewhere — try again once it finishes</div>}
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
              playing={playing === stem.kind}
              reextractBlocked={busyElsewhere}
              onTogglePreview={() => togglePreview(stem.kind, stem.audioFile)}
              onClaim={(action) => claim(stem.kind, action)}
              onReextract={() => reextract(stem.kind)}
            />
          ))}
        </>
      )}
      {error && <div className="error">{error}</div>}
      <audio ref={audioRef} onEnded={() => setPlaying(null)} />
    </div>
  );
}
