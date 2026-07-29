import type { SongDetail } from './api';
import { AudioPreview } from './AudioPreview';
import { RemasterAction } from './RemasterAction';

interface Props {
  song: SongDetail;
  onBack: () => void;
}

/** Right-rail export view — per-layer stem download, plus the Remaster action (see PLAN.md's Export & Remaster design). */
export function ExportPanel({ song, onBack }: Props) {
  return (
    <div className="export-panel">
      <div className="export-head">
        <span className="section-label" style={{ margin: 0 }}>EXPORT</span>
        <button className="link-btn" onClick={onBack}><span>← HISTORY</span></button>
      </div>
      <div className="hint">audition or download each layer's active version as a separate stem</div>
      {song.layers.map((layer) => {
        const active = layer.versions.find((v) => v.active);
        if (!active) return null;
        const ext = active.audio_file.slice(active.audio_file.lastIndexOf('.') + 1) || 'wav';
        return (
          <div key={layer.id} className="stem-row">
            <div className="stem-row-head">
              <span className="stem-name">{layer.name}</span>
              <a className="link-btn stem-dl" href={`/audio/${active.audio_file}`} download={`${song.title} - ${layer.name}.${ext}`}>
                <span>DOWNLOAD</span>
              </a>
            </div>
            <AudioPreview src={`/audio/${active.audio_file}`} label={layer.name} height={24} />
          </div>
        );
      })}
      <RemasterAction songId={song.id} layers={song.layers} />
    </div>
  );
}
