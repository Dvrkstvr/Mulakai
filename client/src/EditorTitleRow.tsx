import type { SongDetail } from './api';

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/** Editor's song title with its duration / bpm / key / layer-count meta line. */
export function EditorTitleRow({ song, duration }: { song: SongDetail; duration: number }) {
  return (
    <div className="title-row">
      <span className="song-title">{song.title}</span>
      <span className="meta">
        {duration ? fmt(duration) : ''}{song.bpm ? ` · ${song.bpm} bpm` : ''}{song.key_scale ? ` · ${song.key_scale}` : ''}
        {` · ${song.layers.length} layer${song.layers.length === 1 ? '' : 's'}`}
      </span>
    </div>
  );
}
