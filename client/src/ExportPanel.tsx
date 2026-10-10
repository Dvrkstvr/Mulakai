import { useEffect, useState } from 'react';
import type { SongDetail } from './api';
import { DockExport } from './DockExport';

interface Props {
  song: SongDetail;
  open: boolean;
  onClose: () => void;
}

/** EXPORT, opened from the header's EXPORT ▾ (PLAN.md "Editor Redesign", PR 10): it never edits the song, so it lives
 * apart from the action bar and can be reached whatever is selected. Mounted (hidden) once opened, so its choice and a
 * running remaster's DOWNLOAD survive closing it. Escape or ✕ CLOSE closes it. */
export function ExportPanel({ song, open, onClose }: Props) {
  const [opened, setOpened] = useState(open);
  if (open && !opened) setOpened(true);

  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape' && !e.defaultPrevented) { e.preventDefault(); onClose(); } };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [open, onClose]);

  if (!opened) return null;
  return (
    <section className="export-panel" role="region" aria-label="Export" hidden={!open}>
      <div className="export-panel-head">
        <span className="export-panel-title">EXPORT · {song.title.toUpperCase()}</span>
        <button type="button" className="tab dock-quiet" onClick={onClose}><span>✕ CLOSE</span><span className="kbd" aria-hidden="true">ESC</span></button>
      </div>
      <DockExport song={song} />
    </section>
  );
}

/** The header's EXPORT ▾ button; it says when a remaster is on its way. */
export function ExportButton({ open, remastering, onToggle }: { open: boolean; remastering: boolean; onToggle: () => void }) {
  return (
    <button type="button" className={`tab header-export${open ? ' on' : ''}`} aria-expanded={open} aria-keyshortcuts="E" onClick={onToggle}>
      <span>{remastering ? 'EXPORT · REMASTERING ▾' : 'EXPORT ▾'}</span>
    </button>
  );
}
