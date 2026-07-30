import { useEffect, useState } from 'react';
import { api, type Song } from './api';
import { Dropzone } from './Dropzone';

/** The song detail rail's OUTPUT FILE TAGS block — per-song ID3 fields written into the
 * exported file (Artist/Encoder/ID3 version stay global, in Settings > Output File
 * Metadata). Split out of SongDetailRail.tsx, which owns the rail's identity/metadata
 * half and was over the module cap; these fields share nothing with it but the song. */
export function SongOutputTags({ song, onChanged }: { song: Song; onChanged: () => void }) {
  const [genre, setGenre] = useState(song.genre);
  const [album, setAlbum] = useState(song.album);
  const [coverUploading, setCoverUploading] = useState(false);

  useEffect(() => setGenre(song.genre), [song.genre]);
  useEffect(() => setAlbum(song.album), [song.album]);

  const commitGenre = () => {
    if (genre === song.genre) return;
    api.updateSongMetadata(song.id, { genre }).then(onChanged);
  };

  const commitAlbum = () => {
    if (album === song.album) return;
    api.updateSongMetadata(song.id, { album }).then(onChanged);
  };

  const uploadCoverArt = async (file: File) => {
    setCoverUploading(true);
    try {
      await api.uploadSongCoverArt(song.id, file);
      onChanged();
    } finally {
      setCoverUploading(false);
    }
  };

  const removeCoverArt = async () => {
    await api.deleteSongCoverArt(song.id);
    onChanged();
  };

  return (
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
          <Dropzone accept="image/*" disabled={coverUploading} onFile={uploadCoverArt}>
            {coverUploading ? 'uploading…' : 'drag an image here or click to upload cover art'}
          </Dropzone>
        )}
      </div>
    </div>
  );
}
