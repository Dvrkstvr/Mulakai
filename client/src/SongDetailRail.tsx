import { useEffect, useRef, useState } from 'react';
import { api, type Folder, type Song } from './api';
import { attempt } from './actionError';
import { timeSignatureLabel } from './songMeta';
import { CustomSelect } from './CustomSelect';
import { SongOutputTags } from './SongOutputTags';
import { ReferenceAudioMeta } from './ReferenceAudioMeta';
import { useVoiceStore } from './voiceStore';
import { taskToGenType, GEN_TYPE_LABEL, START_FROM } from './createDraft';

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
  // The voice that conditioned this generation, when the stored label still matches a
  // saved voice — ad-hoc uploaded clips aren't persisted, so those stay label-only.
  const voices = useVoiceStore((s) => s.voices);
  const fetchVoices = useVoiceStore((s) => s.fetchVoices);
  const [voicesError, setVoicesError] = useState('');
  const loadVoices = () => void attempt("couldn't load voices", fetchVoices, setVoicesError);
  useEffect(() => {
    if (song.reference_audio_label) loadVoices();
    else setVoicesError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [song.reference_audio_label]);
  const referenceVoice = song.reference_audio_label
    ? voices.find((v) => v.name === song.reference_audio_label) ?? null
    : null;

  const origin = taskToGenType(song.gen_task);
  // Engine ids and their labels coincide ('yue2' -> 'YUE2'), so the rail needs no engine list.
  const engineLabel = song.engine ? song.engine.toUpperCase() : '';
  const generatedWith = engineLabel ? `${GEN_TYPE_LABEL[origin]} · ${engineLabel}` : GEN_TYPE_LABEL[origin];
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(song.title);
  const [comment, setComment] = useState(song.comment);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setTitle(song.title), [song.title]);
  useEffect(() => setComment(song.comment), [song.comment]);
  useEffect(() => setError(''), [song.id]); // the rail stays mounted across songs
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
    // A refused rename snaps back to the stored title rather than leaving the rejected one up.
    void attempt("couldn't rename", () => api.renameSong(song.id, trimmed).then(onRenamed), setError)
      .then((ok) => { if (!ok) setTitle(song.title); });
  };

  const commitComment = () => {
    if (comment === song.comment) return;
    // A refused comment stays in the box, so clicking away again retries it.
    void attempt("comment not saved", () => api.updateSongMetadata(song.id, { comment }).then(onRenamed), setError);
  };

  const folderOptions = [{ label: 'UNFILED', value: UNFILED }, ...folders.map((f) => ({ label: f.name.toUpperCase(), value: f.id }))];
  const moveFolder = (folderId: string) => {
    void attempt("couldn't move to folder", () => api.moveSongToFolder(song.id, folderId || null).then(onRenamed), setError);
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
        {error && <div className="error">{error}</div>}

        <CustomSelect label="FOLDER" value={song.folder_id ?? UNFILED} onChange={moveFolder} options={folderOptions} />

        <div className="detail-meta">
          <div className="section-header">METADATA</div>
          <MetaRow label="GENERATED WITH" value={generatedWith} />
          <MetaRow label="BPM" value={song.bpm ? String(song.bpm) : 'AUTO'} />
          <MetaRow label="KEY / SCALE" value={song.key_scale || 'AUTO'} />
          <MetaRow label="TIME SIGNATURE" value={song.time_signature ? timeSignatureLabel(song.time_signature) : 'AUTO'} />
          <MetaRow label="DURATION" value={song.duration ? fmtDuration(song.duration) : 'AUTO'} />
          {song.reference_audio_label && (
            <ReferenceAudioMeta song={song} voice={referenceVoice} voicesError={voicesError} onRetry={loadVoices} />
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
        <div className="hint">
          {origin === 'prompt'
            ? `Opens Create on ${START_FROM.prompt.title}${engineLabel ? ` with ${engineLabel}` : ''} with this prompt, lyrics and song details.`
            : origin === 'audio' && engineLabel
              ? `Opens Create on ${START_FROM.audio.title} with ${engineLabel} and this cover’s score, prompt and lyrics — ready to cover the same melody again, no source needed.`
              : `Opens Create on ${START_FROM[origin].title} — the start this song was made from — with its prompt, lyrics and song details; you pick a new source track there.`}
        </div>

        <SongOutputTags song={song} onChanged={onRenamed} />
      </div>
    </aside>
  );
}
