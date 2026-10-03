import { AIGeneratingBackground } from './AIGeneratingBackground';
import type { ActivityEntry, ActivityKind } from './activitySettle';
import type { RunningRow } from './activityRunning';
import { useApiStatusStore } from './apiStatusStore';
import { fmtElapsed, fmtProgress, useElapsedMs } from './genProgress';
import { fmtAgo } from './recentSongs';

/** A row's name when no song names it: these jobs work on Create's cover draft or in the background. */
const UNTITLED: Partial<Record<ActivityKind, string>> = {
  transcribe: 'Cover draft', lyrics: 'Cover draft', analyze: 'Source audio', timings: 'Lyric timing',
  sample: 'Feeling lucky',
};
const rowTitle = (kind: ActivityKind, title?: string) => title ?? UNTITLED[kind] ?? 'Untitled';

const DONE_LABEL: Record<ActivityKind, string> = {
  generate: 'GENERATED', repaint: 'REPAINTED', regenerate: 'ALT TAKE', retake: 'SIMILAR TAKE', addLayer: 'ADDED A LAYER',
  remaster: 'REMASTERED', split: 'SPLIT', transcribe: 'TRANSCRIBED', lyrics: 'READ LYRICS', timings: 'TIMED LYRICS',
  analyze: 'ANALYZED', sample: 'ROLLED A SAMPLE',
};

const KIND_NAME: Record<ActivityKind, string> = {
  generate: 'generation', repaint: 'repaint', regenerate: 'alt take', retake: 'similar take', addLayer: 'add layer',
  remaster: 'remaster', split: 'split', transcribe: 'transcription', lyrics: 'read lyrics', timings: 'word timing',
  analyze: 'analysis', sample: 'feeling lucky',
};

/** RUNNING: audio-making jobs wear the AI shader (veiled by progress when it's whole-job
 * progress); reading jobs stay plain with a hairline bar. ABORT sits on the lock's holder. */
export function RunningActivityRow({ row, title }: { row: RunningRow; title?: string }) {
  const abort = useApiStatusStore((s) => s.abort);
  const aborting = useApiStatusStore((s) => s.aborting);
  const elapsed = useElapsedMs(!!row.startedAt, row.startedAt ?? null);
  const pct = fmtProgress(row.progress);
  const name = rowTitle(row.kind, title);
  const abortBtn = row.abortable && (
    <button type="button" className="activity-quiet" onClick={() => void abort()} disabled={aborting}>
      <span>{aborting ? 'ABORTING…' : 'ABORT'}</span>
    </button>
  );
  if (row.ai) {
    return (
      <div className="activity-job ai">
        <AIGeneratingBackground progress={row.stageProgress ? undefined : row.progress} />
        <div className="activity-job-head">
          <span className="activity-title">{name}</span>
          {row.startedAt !== undefined && <span className="activity-mono">{fmtElapsed(elapsed)}</span>}
        </div>
        <div className="activity-job-head">
          <span className="activity-stage">{row.label}{pct && ` · ${pct}`}</span>
          {abortBtn}
        </div>
      </div>
    );
  }
  return (
    <div className="activity-job">
      <div className="activity-job-head">
        <span className="activity-title">{name}</span>
        <span className="activity-mono">{pct ?? (row.startedAt ? fmtElapsed(elapsed) : '')}</span>
      </div>
      {row.progress !== undefined && (
        <div className="activity-bar"><div style={{ width: pct ?? '0%' }} /></div>
      )}
      <div className="activity-job-head">
        <span className="activity-stage plain">{row.label}</span>
        {abortBtn}
      </div>
    </div>
  );
}

interface SettledProps {
  entry: ActivityEntry;
  title?: string;
  onOpen?: () => void;
  onRetry?: () => void;
}

/** DONE: the result badge (lilac) and OPEN. FAILED: rust, the reason, and RETRY. */
export function SettledActivityRow({ entry, title, onOpen, onRetry }: SettledProps) {
  const name = rowTitle(entry.kind, title ?? entry.title);
  if (entry.status === 'failed') {
    return (
      <div className="activity-job failed">
        <span className="activity-title">{name} · {KIND_NAME[entry.kind]} failed</span>
        <div className="activity-job-head">
          <span className="activity-detail" title={entry.error}>{entry.error} · settings kept</span>
          {onRetry && <button type="button" className="activity-retry" onClick={onRetry}><span>RETRY</span></button>}
        </div>
        {entry.note && <span className="activity-note">{entry.note}</span>}
      </div>
    );
  }
  return (
    <div className="activity-job">
      <div className="activity-job-head">
        <span className="activity-title">{name}</span>
        {entry.badge && <span className="activity-badge"><span>{entry.badge}</span></span>}
      </div>
      <div className="activity-job-head">
        <span className="activity-detail">{DONE_LABEL[entry.kind]} · {fmtAgo(entry.at)}</span>
        {onOpen && <button type="button" className="activity-open" onClick={onOpen}><span>OPEN</span></button>}
      </div>
    </div>
  );
}
