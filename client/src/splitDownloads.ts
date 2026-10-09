/** Downloads from the Editor's SPLIT dock: a stem's file name, the stems ready to download, and DOWNLOAD ALL as one
 * browser download per stem, staggered so the browser takes each (no zip). */
import type { StemKind, StemResult } from './api';

export const STEM_LABELS: Record<StemKind, string> = {
  vocals: 'Vocals',
  drums: 'Drums',
  bass: 'Bass',
  other: 'Other',
};

/** Between two downloads of DOWNLOAD ALL. */
export const DOWNLOAD_GAP_MS = 400;

export interface StemDownload { href: string; name: string }

/** A done, unclaimed take as `<LAYER> - <Stem>.<ext>`; null while it runs, failed, or once claimed. */
export function stemDownload(stem: StemResult, layerName: string): StemDownload | null {
  if (stem.status !== 'done' || stem.claimed || !stem.audioFile) return null;
  const dot = stem.audioFile.lastIndexOf('.');
  const ext = dot > 0 ? stem.audioFile.slice(dot) : '';
  return { href: `/audio/${stem.audioFile}`, name: `${layerName} - ${STEM_LABELS[stem.kind]}${ext}` };
}

export function stemDownloads(stems: StemResult[], layerName: string): StemDownload[] {
  return stems.map((s) => stemDownload(s, layerName)).filter((d): d is StemDownload => d !== null);
}

function clickDownload({ href, name }: StemDownload): void {
  const a = document.createElement('a');
  a.href = href;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
}

/** Start each download `gap` ms after the last. */
export function downloadAll(items: StemDownload[], click: (d: StemDownload) => void = clickDownload, gap = DOWNLOAD_GAP_MS): void {
  items.forEach((d, i) => setTimeout(() => click(d), i * gap));
}

/** SPLIT ALL AGAIN's stems: unclaimed and not running. */
export const splitAgainKinds = (stems: StemResult[]): StemKind[] =>
  stems.filter((s) => !s.claimed && s.status !== 'running').map((s) => s.kind);
