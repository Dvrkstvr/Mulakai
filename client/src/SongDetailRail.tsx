import type { Song } from './api';
import { timeSignatureLabel } from './songMeta';

interface Props {
  song: Song;
  onClose: () => void;
  onReusePrompt: (song: Song) => void;
  onCreateCover: (song: Song) => void;
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
export function SongDetailRail({ song, onClose, onReusePrompt, onCreateCover }: Props) {
  return (
    <aside className="rail song-detail-rail">
      <div className="song-detail-panel">
        <div className="field-label-row">
          <span className="section-label">SONG DETAIL</span>
          <button className="rail-close" onClick={onClose}>&times;</button>
        </div>

        <div className="song-title">{song.title}</div>
        <p className="meta">{song.caption}</p>

        <div className="detail-meta">
          <div className="section-label">METADATA</div>
          <MetaRow label="BPM" value={song.bpm ? String(song.bpm) : 'AUTO'} />
          <MetaRow label="KEY / SCALE" value={song.key_scale || 'AUTO'} />
          <MetaRow label="TIME SIGNATURE" value={song.time_signature ? timeSignatureLabel(song.time_signature) : 'AUTO'} />
          <MetaRow label="DURATION" value={song.duration ? fmtDuration(song.duration) : 'AUTO'} />
        </div>

        {song.lyrics && (
          <div className="detail-lyrics">
            <div className="section-label">LYRICS</div>
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
