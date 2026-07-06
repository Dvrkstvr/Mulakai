import { useEffect, useRef, useState } from 'react';
import { api, type Song } from './api';
import { timeSignatureLabel } from './songMeta';

interface Props {
  song: Song;
  onClose: () => void;
  onReusePrompt: (song: Song) => void;
  onCreateCover: (song: Song) => void;
  onRenamed: () => void;
}

const fmtDuration = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="detail-meta-row">
      <span className="section-label">{label}</span>
      <span>{value}</span>
    </div>
  );
}

/** Library's right-hand rail: metadata + quick actions for a selected song, same
 * carbon-panel idiom as Editor's version rail / Create's refine rail. Opens on a
 * row/title click (not EDIT, which still opens the full Editor). */
export function SongDetailRail({ song, onClose, onReusePrompt, onCreateCover, onRenamed }: Props) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(song.title);
  const [comment, setComment] = useState(song.comment);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setTitle(song.title), [song.title]);
  useEffect(() => setComment(song.comment), [song.comment]);
  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const commitRename = () => {
    setEditing(false);
    const trimmed = title.trim();
    if (!trimmed || trimmed === song.title) {
      setTitle(song.title);
      return;
    }
    api.renameSong(song.id, trimmed).then(onRenamed);
  };

  const commitComment = () => {
    if (comment === song.comment) return;
    api.updateSongComment(song.id, comment).then(onRenamed);
  };

  return (
    <aside className="rail song-detail-rail">
      <div className="song-detail-panel">
        <div className="field-label-row">
          <span className="section-header">SONG DETAIL</span>
          <button className="rail-close" onClick={onClose}>&times;</button>
        </div>

        {editing ? (
          <input
            ref={inputRef}
            className="song-title-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') { setTitle(song.title); setEditing(false); }
            }}
          />
        ) : (
          <div className="song-title" onDoubleClick={() => setEditing(true)}>{song.title}</div>
        )}
        <p className="meta">{song.caption}</p>

        <div className="detail-meta">
          <div className="section-header">METADATA</div>
          <MetaRow label="BPM" value={song.bpm ? String(song.bpm) : 'AUTO'} />
          <MetaRow label="KEY / SCALE" value={song.key_scale || 'AUTO'} />
          <MetaRow label="TIME SIGNATURE" value={song.time_signature ? timeSignatureLabel(song.time_signature) : 'AUTO'} />
          <MetaRow label="DURATION" value={song.duration ? fmtDuration(song.duration) : 'AUTO'} />
        </div>

        <div className="detail-meta">
          <div className="section-header">COMMENT</div>
          <textarea
            className="detail-comment"
            placeholder="Notes embedded in the file's comment tag"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            onBlur={commitComment}
          />
        </div>

        {song.lyrics && (
          <div className="detail-lyrics">
            <div className="section-header">LYRICS</div>
            <pre>{song.lyrics}</pre>
          </div>
        )}

        <div className="detail-actions">
          <button className="acid" onClick={() => onReusePrompt(song)}>REUSE PROMPT</button>
          <button className="acid-outline" onClick={() => onCreateCover(song)}>CREATE COVER FROM AUDIO</button>
        </div>
      </div>
    </aside>
  );
}
