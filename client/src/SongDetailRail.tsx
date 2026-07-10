import { useEffect, useRef, useState } from 'react';
import { api, type Folder, type Song } from './api';
import { timeSignatureLabel } from './songMeta';
import { CustomSelect } from './CustomSelect';

interface Props {
  song: Song;
  folders: Folder[];
  onClose: () => void;
  onReusePrompt: (song: Song) => void;
  onCreateCover: (song: Song) => void;
  onRenamed: () => void;
}

const UNFILED = '';

const fmtDuration = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/** "<name>" plus influence percentages when present (text2music); label alone for cover/complete. */
const referenceAudioValue = (song: Song): string => {
  const label = song.reference_audio_label ?? '';
  if (song.reference_audio_influence == null) return label;
  return `${label} — audio ${Math.round(song.reference_audio_influence * 100)}% / style ${Math.round((song.reference_style_influence ?? 0) * 100)}%`;
};

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
 * row/title click (not EDIT, which still opens the full Editor).
 * Genre/album/cover art/comment are per-song output-file tag fields (Artist/Encoder/ID3
 * version stay as global defaults in Settings > Output File Metadata). */
export function SongDetailRail({ song, folders, onClose, onReusePrompt, onCreateCover, onRenamed }: Props) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(song.title);
  const [comment, setComment] = useState(song.comment);
  const [genre, setGenre] = useState(song.genre);
  const [album, setAlbum] = useState(song.album);
  const [coverUploading, setCoverUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setTitle(song.title), [song.title]);
  useEffect(() => setComment(song.comment), [song.comment]);
  useEffect(() => setGenre(song.genre), [song.genre]);
  useEffect(() => setAlbum(song.album), [song.album]);
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
    api.updateSongMetadata(song.id, { comment }).then(onRenamed);
  };

  const commitGenre = () => {
    if (genre === song.genre) return;
    api.updateSongMetadata(song.id, { genre }).then(onRenamed);
  };

  const commitAlbum = () => {
    if (album === song.album) return;
    api.updateSongMetadata(song.id, { album }).then(onRenamed);
  };

  const uploadCoverArt = async (file: File) => {
    setCoverUploading(true);
    try {
      await api.uploadSongCoverArt(song.id, file);
      onRenamed();
    } finally {
      setCoverUploading(false);
    }
  };

  const removeCoverArt = async () => {
    await api.deleteSongCoverArt(song.id);
    onRenamed();
  };

  const folderOptions = [{ label: 'UNFILED', value: UNFILED }, ...folders.map((f) => ({ label: f.name.toUpperCase(), value: f.id }))];
  const moveFolder = (folderId: string) => {
    api.moveSongToFolder(song.id, folderId || null).then(onRenamed);
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

        <CustomSelect label="FOLDER" value={song.folder_id ?? UNFILED} onChange={moveFolder} options={folderOptions} />

        <div className="detail-meta">
          <div className="section-header">METADATA</div>
          <MetaRow label="BPM" value={song.bpm ? String(song.bpm) : 'AUTO'} />
          <MetaRow label="KEY / SCALE" value={song.key_scale || 'AUTO'} />
          <MetaRow label="TIME SIGNATURE" value={song.time_signature ? timeSignatureLabel(song.time_signature) : 'AUTO'} />
          <MetaRow label="DURATION" value={song.duration ? fmtDuration(song.duration) : 'AUTO'} />
          {song.reference_audio_label && (
            <MetaRow label="REFERENCE AUDIO" value={referenceAudioValue(song)} />
          )}
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

        <div className="detail-meta">
          <div className="section-header">OUTPUT FILE TAGS</div>
          <div className="setting">
            <div className="setting-head"><span>GENRE</span></div>
            <input value={genre} onChange={(e) => setGenre(e.target.value)} onBlur={commitGenre} placeholder="AUTO — left blank" />
          </div>
          <div className="setting">
            <div className="setting-head"><span>ALBUM</span></div>
            <input value={album} onChange={(e) => setAlbum(e.target.value)} onBlur={commitAlbum} placeholder="AUTO — left blank" />
          </div>
          <div className="setting">
            <div className="setting-head"><span>COVER ART</span></div>
            {song.cover_art_file ? (
              <div className="voice-list-row">
                <img src={`/audio/${song.cover_art_file}`} alt="Cover art" style={{ width: 40, height: 40, objectFit: 'cover' }} />
                <button onClick={removeCoverArt}><span>REMOVE</span></button>
              </div>
            ) : (
              <label className="dropzone">
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  disabled={coverUploading}
                  onChange={(e) => e.target.files?.[0] && uploadCoverArt(e.target.files[0])}
                />
                {coverUploading ? 'uploading…' : 'click to upload cover art'}
              </label>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
