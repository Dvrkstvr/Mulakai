import type { LyricsBlock } from './lyricsBlocks';
import { LyricsPanel } from './LyricsPanel';
import { SettingsPanel } from './SettingsPanel';
import { VoicePicker } from './VoicePicker';
import { ResizeHandle } from './ResizeHandle';

interface Props {
  addingLayerExpanded: boolean;
  requestAddingLayerExpanded: (next: boolean) => void;
  lyricsBlocks: LyricsBlock[];
  lyricsDraft: string;
  onLyricsDraftChange: (text: string) => void;
  activeLyricsBlock: LyricsBlock | null;
  lyricsUnlocked: boolean;
  songLyrics: string;
  onResizePointerDown: (e: React.PointerEvent) => void;
}

/** Editor's left rail: the Add Layer voice picker (while expanded), lyrics, and repaint settings. */
export function EditorLeftRail({
  addingLayerExpanded, requestAddingLayerExpanded, lyricsBlocks, lyricsDraft, onLyricsDraftChange,
  activeLyricsBlock, lyricsUnlocked, songLyrics, onResizePointerDown,
}: Props) {
  return (
    <div className="resizable-col">
      <div className="left-rail">
        {addingLayerExpanded && (
          <div onMouseEnter={() => requestAddingLayerExpanded(true)} onMouseLeave={() => requestAddingLayerExpanded(false)}>
            <div className="section-label">ADD LAYER VOICE</div>
            <VoicePicker />
          </div>
        )}
        <LyricsPanel
          blocks={lyricsBlocks}
          draft={lyricsDraft}
          onDraftChange={onLyricsDraftChange}
          activeBlock={activeLyricsBlock}
          unlocked={lyricsUnlocked}
        />
        {/* While Add Layer is active this panel hosts its lyrics editor, so hovering/
            focusing it must keep the Add Layer context alive (same debounced keep-alive
            as the voice block above). Guarded on addingLayerExpanded so plain Repaint use
            never flips the panel into Add Layer mode. */}
        <div
          className="rail-settings-slot"
          onMouseEnter={() => { if (addingLayerExpanded) requestAddingLayerExpanded(true); }}
          onMouseLeave={() => { if (addingLayerExpanded) requestAddingLayerExpanded(false); }}
          onFocus={() => { if (addingLayerExpanded) requestAddingLayerExpanded(true); }}
        >
          <SettingsPanel mode="repaint" addLayerActive={addingLayerExpanded} songLyrics={songLyrics} />
        </div>
      </div>
      <ResizeHandle side="right" onPointerDown={onResizePointerDown} />
    </div>
  );
}
