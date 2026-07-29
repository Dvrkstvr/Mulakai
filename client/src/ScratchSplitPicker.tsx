import { useEffect, useRef, useState } from 'react';
import { api, ApiError, type StemKind, type StemResult } from './api';
import { AudioPreview } from './AudioPreview';
import { previewPlayback } from './previewPlayback';
import { Dropzone } from './Dropzone';

interface Props {
  /** Fired when the user picks a ready stem to use as a generation source — the split job/
   * stems stay around (still downloadable) after this fires, nothing is consumed. */
  onUseStem: (jobId: string, kind: StemKind) => void;
}

const POLL_MS = 2000;

/**
 * Standalone stem split: upload any song, run ACE-Step `extract` or Demucs, get back
 * downloadable stems — no song/library entry is ever created. Doubles as a source-picker
 * for Complete generation (CreateCompleteTab.tsx) via `onUseStem`, but is fully usable on
 * its own (split, download, done) per the "bonus" utility request. Stem playback goes
 * through the shared previewPlayback slot via AudioPreview.
 */
export function ScratchSplitPicker({ onUseStem }: Props) {
  const [health, setHealth] = useState<{ acestep: boolean; demucs: boolean } | null>(null);
  const [model, setModel] = useState<'acestep' | 'demucs' | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [stems, setStems] = useState<StemResult[] | null>(null);
  const [splitting, setSplitting] = useState(false);
  const [error, setError] = useState('');
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    api.splitHealth().then(setHealth).catch(() => setHealth({ acestep: false, demucs: false }));
  }, []);

  useEffect(() => {
    if (model || !health) return;
    if (health.acestep) setModel('acestep');
    else if (health.demucs) setModel('demucs');
  }, [health, model]);

  useEffect(() => () => {
    if (pollRef.current) window.clearInterval(pollRef.current);
  }, []);

  const poll = (id: string) => {
    pollRef.current = window.setInterval(async () => {
      try {
        const status = await api.scratchSplitStatus(id);
        setStems(status.stems);
        if (status.status === 'done' && pollRef.current) {
          window.clearInterval(pollRef.current);
          setSplitting(false);
        }
      } catch (err) {
        // 404 = the job was force-stopped elsewhere (header's ABORT pill, or another
        // tab) — scratchSplitJobs.ts's discard deletes it outright, so unlike other job
        // kinds there's no "aborted" status to poll for. Any other error is transient.
        if (err instanceof ApiError && err.status === 404 && pollRef.current) {
          window.clearInterval(pollRef.current);
          setSplitting(false);
          setJobId(null);
          setStems(null);
          setError('Split aborted');
        }
      }
    }, POLL_MS);
  };

  const split = async () => {
    if (!file || !model) return;
    setError('');
    setSplitting(true);
    setStems(null);
    try {
      const { jobId: id } = await api.splitScratch(file, model);
      setJobId(id);
      poll(id);
    } catch (err) {
      setSplitting(false);
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const reset = () => {
    if (pollRef.current) window.clearInterval(pollRef.current);
    if (jobId) void api.discardScratchSplit(jobId);
    previewPlayback.stop();
    setJobId(null);
    setStems(null);
    setFile(null);
    setSplitting(false);
  };

  const canSubmit = !!file && !!model && !!health?.[model] && !splitting;

  return (
    <div className="split-panel">
      {!stems ? (
        <>
          <Dropzone accept="audio/*" onFile={setFile}>
            {file ? file.name : 'drag a full song here or click to browse'}
          </Dropzone>
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
          <button className="acid" disabled={!canSubmit} onClick={split}>
            {splitting ? 'SPLITTING…' : 'SPLIT INTO STEMS'}
          </button>
        </>
      ) : (
        <>
          <div className="hint">pick a stem to use as the source track, or just download any of them</div>
          {stems.map((stem) => (
            <div key={stem.kind} className="stem-row">
              <div className="stem-row-head">
                <span className="stem-name">{stem.kind}</span>
                {stem.status === 'running' && <span className="meta">extracting…</span>}
                {stem.status === 'failed' && <span className="error">{stem.error ?? 'failed'}</span>}
                {stem.status === 'done' && jobId && (
                  <>
                    <a className="link-btn" href={api.scratchStemDownloadUrl(jobId, stem.kind)} download>
                      <span>DOWNLOAD</span>
                    </a>
                    <button className="acid-outline" onClick={() => onUseStem(jobId, stem.kind)}>USE AS SOURCE</button>
                  </>
                )}
              </div>
              {stem.status === 'done' && jobId && (
                <AudioPreview src={api.scratchStemDownloadUrl(jobId, stem.kind)} label={stem.kind} />
              )}
            </div>
          ))}
          <button className="link-btn" onClick={reset}><span>SPLIT ANOTHER SONG</span></button>
        </>
      )}
      {error && <div className="error">{error} <button onClick={split}>RETRY</button></div>}
    </div>
  );
}
