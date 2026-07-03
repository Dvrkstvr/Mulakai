import type { SongDetail } from './api';

interface Props {
  song: SongDetail;
  onBack: () => void;
}

/** Right-rail export view — per-layer stem download. Composite mixdown export is still an open question (see PLAN.md's Export note). */
export function ExportPanel({ song, onBack }: Props) {
  return (
    <div className="export-panel">
      <div className="export-head">
        <span className="section-label" style={{ margin: 0 }}>EXPORT</span>
        <button className="link-btn" onClick={onBack}>← HISTORY</button>
      </div>
      <div className="hint">download each layer's active version as a separate stem</div>
      {song.layers.map((layer) => {
        const active = layer.versions.find((v) => v.active);
        if (!active) return null;
        return (
          <a key={layer.id} className="export-stem" href={`/audio/${active.audio_file}`} download={`${song.title} - ${layer.name}.wav`}>
            <span>{layer.name.toUpperCase()}</span>
            <span className="export-stem-dl">DOWNLOAD</span>
          </a>
        );
      })}
    </div>
  );
}
