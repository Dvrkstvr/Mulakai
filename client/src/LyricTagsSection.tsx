import { useEffect, useRef, useState } from 'react';
import { api, type LyricTag, type LyricTagProbeStatus } from './api';

/** Library of `[...]` annotation tags observed from ACE-Step's LM output (structure tags
 * like [Chorus], performance tags like [soft voice]) — there's no fixed vocabulary anywhere,
 * so this is built empirically by probing and persisted additively server-side: re-running
 * only grows counts / adds newly-seen tags, it never overwrites what a prior run found. */
export function LyricTagsSection() {
  const [tags, setTags] = useState<LyricTag[]>([]);
  const [status, setStatus] = useState<LyricTagProbeStatus | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshTags = () => { api.listLyricTags().then(setTags).catch(() => {}); };
  const refreshStatus = () => { api.getLyricTagProbeStatus().then(setStatus).catch(() => {}); };

  useEffect(() => {
    refreshTags();
    refreshStatus();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  useEffect(() => {
    if (status?.running && !pollRef.current) {
      pollRef.current = setInterval(() => { refreshStatus(); refreshTags(); }, 3000);
    } else if (!status?.running && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
      refreshTags();
    }
  }, [status?.running]);

  const startProbe = async () => {
    try { await api.probeLyricTags(); } finally { refreshStatus(); }
  };

  const stopProbe = async () => {
    try { await api.stopLyricTagProbe(); } finally { refreshStatus(); }
  };

  const sorted = [...tags].sort((a, b) => b.count - a.count);

  return (
    <div className="settings-card">
      <span className="section-label">LYRIC TAGS</span>
      <div className="hint">
        Annotation tags ACE-Step actually uses in generated lyrics — probing runs indefinitely
        until stopped, and is additive: it only adds newly discovered tags and grows counts,
        nothing is overwritten.
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button className="voice-manage-btn" disabled={!!status?.running} onClick={startProbe}>
          <span>{status?.running ? `PROBING… ${status.completed} sampled` : 'PROBE FOR NEW TAGS'}</span>
        </button>
        {status?.running && (
          <button className="voice-manage-btn" onClick={stopProbe}>
            <span>STOP</span>
          </button>
        )}
      </div>
      {status?.lastError && (
        <div className="hint" style={{ color: 'var(--rust-text)' }}>{status.lastError}</div>
      )}

      <div className="settings-model-list" style={{ marginTop: 8 }}>
        {sorted.map((t) => (
          <div key={t.tag} className="settings-model-row">
            <div className="settings-model-name">[{t.tag}]</div>
            <span className="hint">{t.kind} &middot; {t.count}&times;</span>
          </div>
        ))}
        {sorted.length === 0 && <div className="empty">No tags discovered yet — run a probe.</div>}
      </div>
    </div>
  );
}
