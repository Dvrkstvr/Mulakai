import { useEffect, useRef, useState } from 'react';
import { api, type Layer, type StemKind, type StemResult } from './api';

interface Props {
  layer: Layer;
  onChanged: () => Promise<void>;
  onBack: () => void;
}

const STEM_LABELS: Record<StemKind, string> = {
  vocals: 'Vocals',
  drums: 'Drums',
  bass: 'Bass',
  other: 'Other',
};

/**
 * Right-rail split view — pick a backend, extract stems, then per-stem
 * preview/replace/add-layer/re-extract. Swaps into the rail in place of
 * history (see ExportPanel.tsx for the sibling view this mirrors).
 */
export function SplitPanel({ layer, onChanged, onBack }: Props) {
  const [health, setHealth] = useState<{ acestep: boolean; demucs: boolean } | null>(null);
  const [model, setModel] = useState<'acestep' | 'demucs' | null>(null);
  const [job, setJob] = useState<'idle' | 'running'>('idle');
  const [jobId, setJobId] = useState<string | null>(null);
  const [stems, setStems] = useState<StemResult[] | null>(null);
  const [error, setError] = useState('');
  const [playing, setPlaying] = useState<StemKind | null>(null);
  const [busyKind, setBusyKind] = useState<StemKind | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    api.splitHealth().then(setHealth).catch(() => setHealth({ acestep: false, demucs: false }));
  }, []);

  useEffect(() => {
    if (model || !health) return;
    if (health.acestep) setModel('acestep');
    else if (health.demucs) setModel('demucs');
  }, [health, model]);

  // Poll continuously while a job is active — re-extract can restart a
  // single stem's `running` state at any point, not just right after GENERATE STEMS.
  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
    const poll = () => {
      api.splitStatus(jobId).then((s) => { if (!cancelled) setStems(s.stems); }).catch(() => {});
    };
    poll();
    const id = window.setInterval(poll, 2000);
    return () => { cancelled = true; window.clearInterval(id); };
  }, [jobId]);

  useEffect(() => {
    const audio = audioRef.current;
    return () => audio?.pause();
  }, []);

  const canSubmit = !!model && !!health?.[model] && job === 'idle';

  const generate = async () => {
    if (!canSubmit || !model) return;
    setError('');
    setJob('running');
    try {
      const { jobId: id } = await api.startSplit(layer.id, model);
      setJobId(id);
      setStems((['vocals', 'drums', 'bass', 'other'] as StemKind[]).map((kind) => ({ kind, status: 'running' })));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setJob('idle');
    }
  };

  const cancel = async () => {
    const id = jobId;
    audioRef.current?.pause();
    setPlaying(null);
    setJobId(null);
    setStems(null);
    setError('');
    if (id) await api.cancelSplit(id).catch(() => {});
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
    if (!jobId) return;
    setBusyKind(kind);
    setError('');
    try {
      await api.claimStem(jobId, kind, action);
      await onChanged();
      setStems((cur) => cur?.map((s) => (s.kind === kind ? { ...s, claimed: action === 'replace' ? 'replaced' : 'added' } : s)) ?? cur);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyKind(null);
    }
  };

  const reextract = async (kind: StemKind) => {
    if (!jobId) return;
    setBusyKind(kind);
    setError('');
    try {
      const stem = await api.reextractStem(jobId, kind);
      setStems((cur) => cur?.map((s) => (s.kind === kind ? stem : s)) ?? cur);
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
            {job === 'running' ? 'STARTING…' : 'GENERATE STEMS'}
          </button>
        </>
      ) : (
        <>
          <button className="link-btn" style={{ color: 'var(--rust-text)' }} onClick={cancel}><span>CANCEL SPLIT</span></button>
          {stems.map((stem) => {
            const locked = !!stem.claimed;
            const busy = busyKind === stem.kind;
            const ready = stem.status === 'done' && !locked && !busy;
            const reextractable = (stem.status === 'done' || stem.status === 'failed') && !locked && !busy;
            return (
              <div key={stem.kind} className="stem-row">
                <div className="stem-row-head">
                  <button
                    className={`stem-play${playing === stem.kind ? ' playing' : ''}`}
                    disabled={stem.status !== 'done' || locked}
                    onClick={() => togglePreview(stem.kind, stem.audioFile)}
                    aria-label={playing === stem.kind ? 'pause preview' : 'play preview'}
                  />
                  <span className="stem-name">{STEM_LABELS[stem.kind]}</span>
                </div>
                {locked ? (
                  <div className="hint">{stem.claimed === 'replaced' ? `replaced ${layer.name}` : 'added as new layer'}</div>
                ) : stem.status === 'running' ? (
                  <div className="hint">extracting…</div>
                ) : stem.status === 'failed' ? (
                  <div className="error">{stem.error ?? 'extraction failed'}</div>
                ) : (
                  <div className="hint">replace will save as v{nextVersion} · add will create a new layer</div>
                )}
                <span className="btn-row">
                  <button disabled={!ready} onClick={() => claim(stem.kind, 'replace')}><span>REPLACE</span></button>
                  <button disabled={!ready} onClick={() => claim(stem.kind, 'add-layer')}><span>ADD LAYER</span></button>
                  <button disabled={!reextractable} onClick={() => reextract(stem.kind)}><span>{busy ? '…' : 'RE-EXTRACT'}</span></button>
                </span>
              </div>
            );
          })}
        </>
      )}
      {error && <div className="error">{error}</div>}
      <audio ref={audioRef} onEnded={() => setPlaying(null)} />
    </div>
  );
}
