import { useEffect, useState } from 'react';
import { api, type Version } from './api';
import type { Region } from './Waveform';
import { motion, AnimatePresence } from 'framer-motion';
import { AudioPreviewPopover } from './AudioPreviewPopover';
import { ScrollArea } from './ScrollArea';
import { useGenerationStore } from './generationStore';
import { useEditorJobStore } from './editorJobStore';
import { fmtElapsed, fmtProgress, stageDetail, useElapsedMs } from './genProgress';

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const VISIBLE_COUNT = 4;

interface Props {
  songId: string;
  layerId: string;
  versions: Version[];
  onSelectRegion: (region: Region) => void;
  onLoadPrompt: (prompt: string) => void;
  onRevert: (versionId: string) => void;
  onChanged: () => Promise<void>;
}

/** Per-layer version list: revert, delete (2-step confirm), regenerate as an untracked alternate. */
export function VersionHistory({ songId, layerId, versions, onSelectRegion, onLoadPrompt, onRevert, onChanged }: Props) {
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [error, setError] = useState('');
  const genJob = useGenerationStore((s) => s.job);
  const otherLock = useGenerationStore((s) => s.otherLock);
  const editorJob = useEditorJobStore((s) => s.editorJob);
  const startRegenerate = useEditorJobStore((s) => s.startRegenerate);
  const startRetake = useEditorJobStore((s) => s.startRetake);
  const dismissEditorJob = useEditorJobStore((s) => s.dismiss);

  // At most one of these can be running for this layer at a time (the global genLock), so a
  // single slot covers both ALT and SIMILAR across every version row.
  const mine = (editorJob?.kind === 'regenerate' || editorJob?.kind === 'retake') && editorJob.layerId === layerId ? editorJob : null;
  const elapsedMs = useElapsedMs(mine?.stage === 'running', mine?.startedAt ?? null);
  const progressSuffix = `${fmtProgress(mine?.progress) ? ` · ${fmtProgress(mine?.progress)}` : ''}${stageDetail(mine?.progressStage) ? ` · ${stageDetail(mine?.progressStage)}` : ''}`;
  const busyOtherKind = !!editorJob && !mine;
  const busy = !!genJob || !!otherLock || busyOtherKind || mine?.stage === 'running';

  // Runs once when *our* regenerate/retake finishes, even if it settled while this Editor/layer
  // wasn't focused — reload picks up the newly appended history row.
  useEffect(() => {
    if (mine?.stage === 'done') void onChanged();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mine?.stage]);

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

  const regenerate = (id: string) => {
    if (busyOtherKind || !!genJob || !!otherLock) return;
    if (mine?.stage === 'running') return;
    if (mine?.stage === 'failed') dismissEditorJob();
    void startRegenerate(layerId, songId, id);
  };

  const retake = (id: string) => {
    if (busyOtherKind || !!genJob || !!otherLock) return;
    if (mine?.stage === 'running') return;
    if (mine?.stage === 'failed') dismissEditorJob();
    void startRetake(layerId, songId, id);
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
      <ScrollArea className="versions-list">
      <AnimatePresence initial={false}>
      {visible.map((v) => {
        const hasRegion = v.region_start !== null && v.region_end !== null;
        return (
          <motion.div key={v.id} layout="position"
            initial={{ opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className={v.active ? 'version current version-enter' : 'version version-enter'}>
            <div className="version-head">
              <AudioPreviewPopover
                src={`/audio/${v.audio_file}`}
                label={v.prompt || v.label || 'version'}
                startAtSeconds={hasRegion ? (v.region_start as number) : undefined}
              />
              {hasRegion ? (
                <span className="version-time clickable" title="double-click to select this region"
                  onDoubleClick={() => onSelectRegion({ start: v.region_start as number, end: v.region_end as number })}>
                  {fmt(v.region_start as number)}–{fmt(v.region_end as number)}
                </span>
              ) : (
                <span className="version-time">{v.label || 'base'}</span>
              )}
            </div>
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
                <button onClick={() => regenerate(v.id)} disabled={busy}
                  title={busyOtherKind ? 'a generation is already running elsewhere' : 'regenerate as an alternate version'}>
                  <span>{mine?.versionId === v.id && mine.kind === 'regenerate' && mine.stage === 'running' ? `ALT… ${fmtElapsed(elapsedMs)}${progressSuffix}` : 'ALT'}</span>
                </button>
                <button onClick={() => retake(v.id)} disabled={busy}
                  title={busyOtherKind ? 'a generation is already running elsewhere' : "generate a similar take from this version's seed, appended to history"}>
                  <span>{mine?.versionId === v.id && mine.kind === 'retake' && mine.stage === 'running' ? `SIMILAR… ${fmtElapsed(elapsedMs)}${progressSuffix}` : 'SIMILAR'}</span>
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
          <span>{showAll ? 'SHOW FEWER' : `SHOW ${versions.length - collapsedIds.size} MORE`}</span>
        </button>
      )}
      {error && <div className="error">{error}</div>}
      {mine?.stage === 'failed' && <div className="error">{mine.error ?? 'generation failed'}</div>}
      </ScrollArea>
    </div>
  );
}
