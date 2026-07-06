import { useEffect, useState } from 'react';
import { api, type OutputMetadata } from './api';

const EMPTY: OutputMetadata = { artist: '', encoder: '', id3Version: '4' };

/** Global defaults stamped onto every generated file's tags. Title/BPM/key come from the
 * song itself; genre/album/cover art/comment are per-song now — see SongDetailRail.tsx's
 * fields under its CREATE COVER FROM AUDIO button. */
export function OutputMetadataSection() {
  const [meta, setMeta] = useState<OutputMetadata>(EMPTY);
  const [artist, setArtist] = useState('');
  const [encoder, setEncoder] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api.getOutputMetadata().then((m) => {
      setMeta(m);
      setArtist(m.artist);
      setEncoder(m.encoder);
    }).catch(() => {});
  }, []);

  const commit = (patch: Partial<Pick<OutputMetadata, 'artist' | 'encoder' | 'id3Version'>>) => {
    api.updateOutputMetadata(patch).then(setMeta).catch((err) => setError(err instanceof Error ? err.message : String(err)));
  };

  return (
    <div className="settings-card">
      <span className="section-label">Output file metadata</span>
      <div className="hint">
        stamped onto every generated file's tags — title/BPM/key come from the song itself;
        genre/album/cover art/comment are per-song, edited from the library's song detail view
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
