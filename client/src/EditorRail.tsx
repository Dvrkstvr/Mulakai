import { api, type Layer } from './api';
import type { Region } from './Waveform';
import { VersionHistory } from './VersionHistory';
import { ResizeHandle } from './ResizeHandle';

interface Props {
  songId: string;
  focusedLayer: Layer;
  onSelectRegion: (region: Region) => void;
  onLoadPrompt: (prompt: string) => void;
  onChanged: () => Promise<void>;
  onResizePointerDown: (e: React.PointerEvent) => void;
}

/** Editor's right rail: the focused layer's VERSIONS, nothing else (export and split live in the dock). */
export function EditorRail({ songId, focusedLayer, onSelectRegion, onLoadPrompt, onChanged, onResizePointerDown }: Props) {
  const revert = async (versionId: string) => {
    await api.activateVersion(versionId);
    await onChanged();
  };

  return (
    <div className="resizable-col">
      <ResizeHandle side="left" onPointerDown={onResizePointerDown} />
      <div className="rail">
        <VersionHistory
          songId={songId}
          layerId={focusedLayer.id}
          layerName={focusedLayer.name}
          versions={focusedLayer.versions}
          onSelectRegion={onSelectRegion}
          onLoadPrompt={onLoadPrompt}
          onRevert={revert}
          onChanged={onChanged}
        />
      </div>
    </div>
  );
}
