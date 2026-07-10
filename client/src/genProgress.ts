import { useEffect, useState } from 'react';

/** Every non-song-generation job kind tracked by editorJobStore.ts. */
export type EditorJobKind = 'repaint' | 'regenerate' | 'retake' | 'addLayer' | 'split' | 'remaster';

export const EDITOR_STAGE_LABEL: Record<EditorJobKind, string> = {
  repaint: 'REPAINTING',
  regenerate: 'REGENERATING',
  retake: 'GENERATING SIMILAR TAKE',
  addLayer: 'ADDING LAYER',
  split: 'EXTRACTING STEMS',
  remaster: 'REMASTERING',
};

/** Shared "0:34"-style elapsed-time formatting for every in-progress generation
 * indicator (library GeneratingCard, and the editor's repaint/remaster/split/add-layer). */
export function fmtElapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Ticks once a second while `active`, so a component can render a live "N:NN elapsed"
 * readout without each call site re-implementing its own interval. Returns 0 when inactive
 * or `startedAt` is unset. */
export function useElapsedMs(active: boolean, startedAt: number | null): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);
  return active && startedAt ? now - startedAt : 0;
}

/** "42%"-style readout of ACE-Step's 0.0-1.0 progress fraction, or null when unknown. */
export function fmtProgress(p?: number): string | null {
  if (p === undefined || !Number.isFinite(p)) return null;
  return `${Math.round(Math.max(0, Math.min(1, p)) * 100)}%`;
}

/** ACE-Step's free-text `stage` is only worth surfacing when it says something beyond
 * "a job is running" — filters out empty/whitespace and the generic default the API sends
 * when no more specific stage label was set ("running", case-insensitive). */
export function stageDetail(stage?: string): string | null {
  const trimmed = stage?.trim();
  if (!trimmed || trimmed.toLowerCase() === 'running') return null;
  return trimmed;
}
