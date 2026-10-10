import { useState } from 'react';
import { api, type Layer } from './api';
import { RailLyrics } from './RailLyrics';
import type { RailLyricsRow } from './railLyricsRows';
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
  /** The LYRICS tab's rows (railLyricsRows). */
  lyrics: RailLyricsRow[];
}

type RailTab = 'lyrics' | 'takes';

/** Editor's right rail (PLAN.md "Editor Redesign", PR 6): LYRICS (the whole song's words; a section's name selects it)
 * and TAKES (the focused layer's versions). Opens on TAKES, where a landed edit shows up. */
export function EditorRail({ songId, focusedLayer, onSelectRegion, onLoadPrompt, onChanged, onResizePointerDown, lyrics }: Props) {
  const [tab, setTab] = useState<RailTab>('takes');
  const revert = async (versionId: string) => {
    await api.activateVersion(versionId);
    await onChanged();
  };

  return (
    <div className="resizable-col">
      <ResizeHandle side="left" onPointerDown={onResizePointerDown} />
      <div className="rail">
        <div className="rail-tabs" role="tablist" aria-label="Rail">
          <button type="button" role="tab" aria-selected={tab === 'lyrics'} className={`tab rail-tab${tab === 'lyrics' ? ' active' : ''}`}
            onClick={() => setTab('lyrics')}><span>LYRICS</span></button>
          <button type="button" role="tab" aria-selected={tab === 'takes'} className={`tab rail-tab${tab === 'takes' ? ' active' : ''}`}
            onClick={() => setTab('takes')}><span>TAKES · {focusedLayer.name.toUpperCase()}</span></button>
        </div>
        {tab === 'lyrics' ? <RailLyrics rows={lyrics} onSelect={onSelectRegion} /> : <VersionHistory
          songId={songId}
          layerId={focusedLayer.id}
          layerName={focusedLayer.name}
          versions={focusedLayer.versions}
          onSelectRegion={onSelectRegion}
          onLoadPrompt={onLoadPrompt}
          onRevert={revert}
          onChanged={onChanged}
        />}
      </div>
    </div>
  );
}
