import { useState } from 'react';
import { api, type Version } from './api';
import type { Region } from './Waveform';
import { motion, AnimatePresence } from 'framer-motion';

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const VISIBLE_COUNT = 4;

interface Props {
  versions: Version[];
  onSelectRegion: (region: Region) => void;
  onLoadPrompt: (prompt: string) => void;
  onRevert: (versionId: string) => void;
  onChanged: () => Promise<void>;
}

/** Per-layer version list: revert, delete (2-step confirm), regenerate as an untracked alternate. */
export function VersionHistory({ versions, onSelectRegion, onLoadPrompt, onRevert, onChanged }: Props) {
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [showAll, setShowAll] = useState(false);

  const del = async (id: string) => {
    if (confirmDelete !== id) { setConfirmDelete(id); return; }
    setConfirmDelete(null);
    setError('');
    try {
      await api.deleteVersion(id);
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const regenerate = async (id: string) => {
    setBusy(id);
    setError('');
    try {
      const { jobId } = await api.regenerateVersion(id);
      for (;;) {
        await new Promise((r) => setTimeout(r, 2000));
        const s = await api.jobStatus(jobId);
        if (s.status === 'done') break;
        if (s.status === 'failed') throw new Error(s.error ?? 'regenerate failed');
      }
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  if (versions.length === 0) return null;

  // Cap to the most recent N, but always keep the active (CURRENT) version
  // visible even if it would otherwise fall outside that window.
  const collapsedIds = new Set(versions.slice(0, VISIBLE_COUNT).map((v) => v.id));
  const activeVersion = versions.find((v) => v.active);
  if (activeVersion) collapsedIds.add(activeVersion.id);
  const hasHidden = versions.length > collapsedIds.size;
  const visible = showAll ? versions : versions.filter((v) => collapsedIds.has(v.id));

  return (
    <div className="versions">
      <div className="section-label">HISTORY</div>
      <AnimatePresence initial={false}>
      {visible.map((v) => {
        const hasRegion = v.region_start !== null && v.region_end !== null;
        return (
          <motion.div key={v.id} layout
            initial={{ opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className={v.active ? 'version current version-enter' : 'version version-enter'}>
            {hasRegion ? (
              <span className="version-time clickable" title="double-click to select this region"
                onDoubleClick={() => onSelectRegion({ start: v.region_start as number, end: v.region_end as number })}>
                {fmt(v.region_start as number)}–{fmt(v.region_end as number)}
              </span>
            ) : (
              <span className="version-time">{v.label || 'base'}</span>
            )}
            <span className={v.prompt ? 'meta clickable' : 'meta'} title={v.prompt ? 'double-click to load into prompt' : undefined}
              onDoubleClick={() => v.prompt && onLoadPrompt(v.prompt)}>
              {v.prompt || v.label || 'version'}
            </span>
            <div className="version-actions">
              <span className="btn-row">
                {v.active ? (
                  <span className="current"><span>CURRENT</span></span>
                ) : (
                  <button onClick={() => {
                    onRevert(v.id);
                    if (hasRegion) onSelectRegion({ start: v.region_start as number, end: v.region_end as number });
                  }} title="revert to this version and select its region">
                    <span>SEL</span>
                  </button>
                )}
                <button onClick={() => regenerate(v.id)} disabled={busy === v.id} title="regenerate as an alternate version">
                  <span>{busy === v.id ? '…' : 'ALT'}</span>
                </button>
                <button
                  className={confirmDelete === v.id ? 'confirm-delete' : 'delete'}
                  disabled={versions.length <= 1}
                  onClick={() => del(v.id)}
                  onBlur={() => setConfirmDelete((c) => (c === v.id ? null : c))}
                  title={confirmDelete === v.id ? 'confirm delete' : 'delete this version'}>
                  <span>{confirmDelete === v.id ? 'CONFIRM?' : 'X'}</span>
                </button>
              </span>
            </div>
          </motion.div>
        );
      })}
      </AnimatePresence>
      {hasHidden && (
        <button className="show-more" onClick={() => setShowAll((s) => !s)}>
          {showAll ? 'SHOW FEWER' : `SHOW ${versions.length - collapsedIds.size} MORE`}
        </button>
      )}
      {error && <div className="error">{error}</div>}
    </div>
  );
}
