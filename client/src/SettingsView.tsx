import { useMemo, useRef } from 'react';
import { useHeaderSlot } from './HeaderSlot';
import { ScrollArea } from './ScrollArea';
import { ModelsSection } from './ModelsSection';
import { AdaptersSection } from './AdaptersSection';
import { EnginesSection } from './EnginesSection';
import { PlaybackExportSection } from './PlaybackExportSection';
import { VoiceManagementSection } from './VoiceManagementSection';
import { LibraryMaintenanceSection } from './LibraryMaintenanceSection';
import { ForgeSection } from './ForgeSection';
import { OutputMetadataSection } from './OutputMetadataSection';
import { LyricTagGuideSection } from './LyricTagGuideSection';
import { LyricTagsSection } from './LyricTagsSection';
import { settingsAnchor } from './settingsSections';

interface Props {
  online: boolean | null;
  onBack: () => void;
}

/** Settings takeover screen — a 4th peer view alongside Library/Create/Editor per
 * docs/design/DESIGN.md's "App model" (own nav entry, shares the header). */
export function SettingsView({ online, onBack }: Props) {
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;
  const headerLeft = useMemo(() => <button onClick={() => onBackRef.current()}>&#8592; LIBRARY</button>, []);
  useHeaderSlot(headerLeft, null);

  return (
    <div className="settings-shell">
      <ScrollArea className="settings-content">
        <div id={settingsAnchor('models')}><ModelsSection online={online} /></div>
        <div id={settingsAnchor('adapters')}><AdaptersSection /></div>
        <div id={settingsAnchor('engines')}><EnginesSection /></div>
        <div id={settingsAnchor('playback')}><PlaybackExportSection /></div>
        <div id={settingsAnchor('voices')}><VoiceManagementSection /></div>
        <div id={settingsAnchor('maintenance')}><LibraryMaintenanceSection /></div>
        <div id={settingsAnchor('forge')}><ForgeSection /></div>
        <div id={settingsAnchor('metadata')}><OutputMetadataSection /></div>
        <div id={settingsAnchor('tag-guide')}><LyricTagGuideSection /></div>
        <div id={settingsAnchor('tags')}><LyricTagsSection /></div>
      </ScrollArea>
    </div>
  );
}
