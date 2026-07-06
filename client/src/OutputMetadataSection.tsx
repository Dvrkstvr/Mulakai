import { useEffect, useState } from 'react';
import { api, type OutputMetadata } from './api';

const EMPTY: OutputMetadata = { artist: '', encoder: '', album: '', genre: '', coverArtUrl: null, id3Version: '4' };

/** Defaults stamped onto every generated file's tags (title/bpm/key come from the song
 * itself; comment is per-song, edited in the Library's song detail rail — see
 * SongDetailRail.tsx). Server-side, not client-persisted, since these are properties of
 * the output files regardless of which browser triggered generation. */
export function OutputMetadataSection() {
  const [meta, setMeta] = useState<OutputMetadata>(EMPTY);
  const [artist, setArtist] = useState('');
  const [encoder, setEncoder] = useState('');
  const [album, setAlbum] = useState('');
  const [genre, setGenre] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const refresh = () => api.getOutputMetadata().then((m) => {
    setMeta(m);
    setArtist(m.artist);
    setEncoder(m.encoder);
    setAlbum(m.album);
    setGenre(m.genre);
  }).catch(() => {});

  useEffect(() => { refresh(); }, []);

  const commit = (patch: Partial<Pick<OutputMetadata, 'artist' | 'encoder' | 'album' | 'genre' | 'id3Version'>>) => {
    api.updateOutputMetadata(patch).then(setMeta).catch((err) => setError(err instanceof Error ? err.message : String(err)));
  };

  const uploadCoverArt = async (file: File) => {
    setUploading(true);
    setError('');
    try {
      setMeta(await api.uploadCoverArt(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
    }
  };

  const removeCoverArt = async () => {
    setMeta(await api.deleteCoverArt());
  };

  return (
    <div className="settings-card">
      <span className="section-label">Output file metadata</span>
      <div className="hint">
        stamped onto every generated file's tags — title/BPM/key come from the song itself;
        comment is edited per-song from the library's song detail view
      </div>

      <div className="setting">
        <div className="setting-head"><span>ARTIST</span></div>
        <input value={artist} onChange={(e) => setArtist(e.target.value)} onBlur={() => commit({ artist })} placeholder="AUTO — left blank" />
      </div>

      <div className="setting">
        <div className="setting-head"><span>ENCODER / SOFTWARE</span></div>
        <input value={encoder} onChange={(e) => setEncoder(e.target.value)} onBlur={() => commit({ encoder })} />
      </div>

      <div className="setting">
        <div className="setting-head"><span>ALBUM</span></div>
        <input value={album} onChange={(e) => setAlbum(e.target.value)} onBlur={() => commit({ album })} placeholder="AUTO — left blank" />
      </div>

      <div className="setting">
        <div className="setting-head"><span>GENRE</span></div>
        <input value={genre} onChange={(e) => setGenre(e.target.value)} onBlur={() => commit({ genre })} placeholder="AUTO — left blank" />
      </div>

      <div className="setting">
        <div className="setting-head"><span>COVER ART</span></div>
        {meta.coverArtUrl ? (
          <div className="voice-list-row">
            <img src={meta.coverArtUrl} alt="Default cover art" style={{ width: 40, height: 40, objectFit: 'cover' }} />
            <button onClick={removeCoverArt}><span>REMOVE</span></button>
          </div>
        ) : (
          <label className="dropzone">
            <input
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              disabled={uploading}
              onChange={(e) => e.target.files?.[0] && uploadCoverArt(e.target.files[0])}
            />
            {uploading ? 'uploading…' : 'click to upload default cover art'}
          </label>
        )}
      </div>

      <div className="setting">
        <div className="setting-head"><span>ID3 VERSION</span></div>
        <div className="type-tabs">
          <button className={meta.id3Version === '3' ? 'tab active' : 'tab'} onClick={() => commit({ id3Version: '3' })}><span>V2.3</span></button>
          <button className={meta.id3Version === '4' ? 'tab active' : 'tab'} onClick={() => commit({ id3Version: '4' })}><span>V2.4</span></button>
        </div>
        <div className="hint">v2.3 is the safest bet for older players; v2.4 supports full UTF-8 tags</div>
      </div>

      {error && <div className="error">{error}</div>}
    </div>
  );
}
