import { useState } from 'react';
import type { Folder, FolderScope } from './api';

interface Props {
  folders: Folder[];
  scope: FolderScope;
  onScope: (scope: FolderScope) => void;
  allCount: number;
  unfiledCount: number;
  onCreateFolder: (name: string) => void;
}

/** Library's persistent left rail — same fixed-width idiom as the Editor's settings panel.
 * Selecting a folder uses sky (selection/scope per DESIGN.md), the same concept as focusing
 * a layer in the Editor; no new hue needed for "which folder am I browsing." */
export function FolderRail({ folders, scope, onScope, allCount, unfiledCount, onCreateFolder }: Props) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');

  const commit = () => {
    const trimmed = name.trim();
    if (trimmed) onCreateFolder(trimmed);
    setName('');
    setAdding(false);
  };

  return (
    <aside className="folder-rail">
      <div className="section-label">Folders</div>
      <div className={scope === null ? 'folder-item pinned selected' : 'folder-item pinned'} onClick={() => onScope(null)}>
        <span className="fname">All Songs</span>
        <span className="fcount">{allCount}</span>
      </div>
      <div className={scope === 'unfiled' ? 'folder-item pinned selected' : 'folder-item pinned'} onClick={() => onScope('unfiled')}>
        <span className="fname">Unfiled</span>
        <span className="fcount">{unfiledCount}</span>
      </div>
      {folders.length > 0 && <div className="folder-divider" />}
      {folders.map((f) => (
        <div
          key={f.id}
          className={scope === f.id ? 'folder-item selected' : 'folder-item'}
          onClick={() => onScope(f.id)}
        >
          <span className="fname">{f.name}</span>
          <span className="fcount">{f.song_count}</span>
        </div>
      ))}
      {adding ? (
        <input
          className="new-folder-input"
          autoFocus
          placeholder="Folder name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') { setName(''); setAdding(false); }
          }}
        />
      ) : (
        <div className="new-folder-row" onClick={() => setAdding(true)}>
          <span className="plus">+</span>
          <span>New Folder</span>
        </div>
      )}
    </aside>
  );
}
