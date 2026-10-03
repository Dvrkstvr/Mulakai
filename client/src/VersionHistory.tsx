import { useState } from 'react';
import { api, type Version } from './api';
import { attempt } from './actionError';
import type { Region } from './Waveform';
import { motion, AnimatePresence } from 'framer-motion';
import { AudioPreviewPopover } from './AudioPreviewPopover';
import { ScrollArea } from './ScrollArea';
import { useEditorJobStore, jobView } from './editorJobStore';
import type { SingleEditorJob } from './editorJob';
import { fmtElapsed, fmtProgress, stageDetail, useElapsedMs } from './genProgress';
import { queueSuffix } from './queueCopy';
import { useJobsAhead } from './queueStore';
import { useNextVersion } from './useLayerQueue';

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const VISIBLE_COUNT = 4;

interface Props {
  songId: string;
  layerId: string;
  layerName: string;
  versions: Version[];
  onSelectRegion: (region: Region) => void;
  onLoadPrompt: (prompt: string) => void;
  onRevert: (versionId: string) => Promise<void>;
  onChanged: () => Promise<void>;
}

/** Per-layer version list: revert, delete (2-step confirm), regenerate as an untracked alternate. */
export function VersionHistory({ songId, layerId, layerName, versions, onSelectRegion, onLoadPrompt, onRevert, onChanged }: Props) {
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [error, setError] = useState('');
  const editorJobs = useEditorJobStore((s) => s.editorJobs);
  const startRegenerate = useEditorJobStore((s) => s.startRegenerate);
  const startRetake = useEditorJobStore((s) => s.startRetake);
  const dismiss = useEditorJobStore((s) => s.dismiss);
  const ahead = useJobsAhead();
  const next = useNextVersion({ id: layerId, name: layerName, versions }, songId);

  // ALT and SIMILAR on this layer, from every version row: several may wait in the queue at once.
  // The Editor reloads the song when one lands (useLandedReload).
  const { inFlight, running, failed } = jobView(editorJobs.filter((j): j is SingleEditorJob & { versionId: string } =>
    (j.kind === 'regenerate' || j.kind === 'retake') && j.layerId === layerId));
  const elapsedMs = useElapsedMs(!!running, running?.startedAt ?? null);
  const progressSuffix = `${fmtProgress(running?.progress) ? ` · ${fmtProgress(running?.progress)}` : ''}${stageDetail(running?.progressStage) ? ` · ${stageDetail(running?.progressStage)}` : ''}`;
  /** A version row's ALT or SIMILAR label while a job it started is in flight. */
  const jobLabel = (versionId: string, kind: 'regenerate' | 'retake', idle: string) => {
    const job = inFlight.find((j) => 'versionId' in j && j.versionId === versionId && j.kind === kind);
    if (!job) return idle;
    return job === running ? `${idle}… ${fmtElapsed(elapsedMs)}${progressSuffix}` : `${idle} · QUEUED`;
  };
  const saves = `saved as ${layerName.toLowerCase()} v${next}${queueSuffix(ahead)}`;

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
    if (failed) dismiss(failed.key);
    void startRegenerate(layerId, songId, id);
  };

  const retake = (id: string) => {
    if (failed) dismiss(failed.key);
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
      <div className="section-label versions-label">VERSIONS · {layerName.toUpperCase()}</div>
      <ScrollArea className="versions-list">
      <AnimatePresence initial={false}>
      {visible.map((v) => {
        // A whole-layer repaint stores end -1 ("to the end"): its label says so, and there is no range to select.
        const hasRegion = v.region_start !== null && v.region_end !== null && v.region_end > 0;
        // An imported file has no generation behind it, so there is nothing for ALT/SIMILAR
        // to replay — both rebuild a request from the version's stored params, which for an
        // import would submit an effectively empty text2music. The server refuses it too
        // (repaintJobs.ts's NOT_REPLAYABLE); this keeps a dead button off the row.
        // An extra engine's take can't be replayed either: both rebuild an ACE-Step request,
        // which would quietly answer a YuE2/HeartMuLa prompt with an ACE-Step song.
        const replayable = v.task_type !== 'import' && !v.engine;
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
                  <button onClick={() => void attempt("couldn't revert", () => onRevert(v.id), setError).then((ok) => {
                    if (ok && hasRegion) onSelectRegion({ start: v.region_start as number, end: v.region_end as number });
                  })} title="revert to this version and select its region">
                    <span>SEL</span>
                  </button>
                )}
                {replayable && (
                  <>
                    <button onClick={() => regenerate(v.id)} title={`regenerate as an alternate version, ${saves}`}>
                      <span>{jobLabel(v.id, 'regenerate', 'ALT')}</span>
                    </button>
                    <button onClick={() => retake(v.id)}
                      title={`generate a similar take from this version's seed, ${saves}`}>
                      <span>{jobLabel(v.id, 'retake', 'SIMILAR')}</span>
                    </button>
                  </>
                )}
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
      {failed && <div className="error">{failed.error ?? 'generation failed'}</div>}
      </ScrollArea>
    </div>
  );
}
