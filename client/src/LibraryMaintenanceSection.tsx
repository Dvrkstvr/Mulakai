import { useEffect, useState } from 'react';
import { api, type Song } from './api';

const fmtBytes = (n: number) => {
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

const daysLeft = (trashedAt: string) => {
  const deletesAt = new Date(trashedAt).getTime() + 7 * 24 * 60 * 60 * 1000;
  return Math.max(0, Math.ceil((deletesAt - Date.now()) / (24 * 60 * 60 * 1000)));
};

/** Storage stats + trashed-song list with restore, plus an immediate empty-trash action
 * (bypasses the normal 7-day sweep). This mirrors Library's own trash state — it isn't a
 * separate feature, just a place to see/act on it without hunting through the list. */
export function LibraryMaintenanceSection() {
  const [stats, setStats] = useState<{ storageBytes: number; songCount: number; trashCount: number } | null>(null);
  const [trash, setTrash] = useState<Song[]>([]);
  const [confirmEmpty, setConfirmEmpty] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = () => {
    api.libraryStats().then(setStats).catch(() => {});
    api.listTrash().then(setTrash).catch(() => {});
  };

  useEffect(() => { refresh(); }, []);

  const restore = async (id: string) => {
    setBusy(true);
    try { await api.trash(id, true); refresh(); } finally { setBusy(false); }
  };

  const emptyTrash = async () => {
    if (!confirmEmpty) { setConfirmEmpty(true); return; }
    setBusy(true);
    try {
      await api.emptyTrash();
      setConfirmEmpty(false);
      refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="settings-card">
      <span className="section-label">LIBRARY MAINTENANCE</span>

      {stats && (
        <div className="settings-stats-row">
          <div className="settings-stat"><div className="settings-stat-val">{fmtBytes(stats.storageBytes)}</div><div className="hint">storage used</div></div>
          <div className="settings-stat"><div className="settings-stat-val">{stats.songCount}</div><div className="hint">songs</div></div>
          <div className="settings-stat"><div className="settings-stat-val" style={{ color: 'var(--rust-text)' }}>{stats.trashCount}</div><div className="hint">pending deletion</div></div>
        </div>
      )}

      <div className="trash-block">
        <div className="section-label" style={{ color: 'var(--rust-text)' }}>TRASH — DELETES AFTER 7 DAYS</div>
        {trash.map((s) => (
          <div key={s.id} className="voice-list-row">
            <span>{s.title} — deletes in {daysLeft(s.trashed_at as string)}d</span>
            <button className="voice-manage-btn" style={{ borderColor: 'var(--acid)', color: 'var(--acid)' }} disabled={busy} onClick={() => restore(s.id)}>
              <span>RESTORE</span>
            </button>
          </div>
        ))}
        {trash.length === 0 && <div className="empty">Trash is empty.</div>}
        {trash.length > 0 && (
          <button className="voice-manage-btn" style={{ marginTop: 8 }} disabled={busy} onClick={emptyTrash}>
            <span>{confirmEmpty ? 'PERMANENT — CONFIRM' : 'EMPTY TRASH NOW'}</span>
          </button>
        )}
      </div>
    </div>
  );
}
