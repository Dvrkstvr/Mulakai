import { api, type Layer, type SongDetail } from './api';
import type { Region } from './Waveform';
import { VersionHistory } from './VersionHistory';
import { ExportPanel } from './ExportPanel';
import { SplitPanel } from './SplitPanel';
import { ResizeHandle } from './ResizeHandle';

export type RailMode = 'history' | 'export' | 'split';

interface Props {
  songId: string;
  song: SongDetail;
  focusedLayer: Layer;
  railMode: RailMode;
  onRailModeChange: (mode: RailMode) => void;
  onSelectRegion: (region: Region) => void;
  onLoadPrompt: (prompt: string) => void;
  onChanged: () => Promise<void>;
  onResizePointerDown: (e: React.PointerEvent) => void;
}

/** Editor's right rail: the focused layer's version history, or the export / split view swapped in its place. */
export function EditorRail({ songId, song, focusedLayer, railMode, onRailModeChange, onSelectRegion, onLoadPrompt, onChanged, onResizePointerDown }: Props) {
  const revert = async (versionId: string) => {
    await api.activateVersion(versionId);
    await onChanged();
  };

  return (
    <div className="resizable-col">
      <ResizeHandle side="left" onPointerDown={onResizePointerDown} />
      <div className="rail">
        {railMode === 'history' ? (
          <>
            <VersionHistory
              songId={songId}
              layerId={focusedLayer.id}
              versions={focusedLayer.versions}
              onSelectRegion={onSelectRegion}
              onLoadPrompt={onLoadPrompt}
              onRevert={revert}
              onChanged={onChanged}
            />
            <button className="rail-export-btn" onClick={() => onRailModeChange('export')}><span>EXPORT</span></button>
          </>
        ) : railMode === 'export' ? (
          <ExportPanel song={song} onBack={() => onRailModeChange('history')} />
        ) : (
          <SplitPanel
            songId={songId}
            layer={focusedLayer}
            onChanged={onChanged}
            onBack={() => onRailModeChange('history')}
          />
        )}
      </div>
    </div>
  );
}
