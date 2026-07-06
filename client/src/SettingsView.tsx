import { useMemo, useRef } from 'react';
import { useHeaderSlot } from './HeaderSlot';
import { ScrollArea } from './ScrollArea';
import { ModelsSection } from './ModelsSection';
import { PlaybackExportSection } from './PlaybackExportSection';
import { VoiceManagementSection } from './VoiceManagementSection';
import { LibraryMaintenanceSection } from './LibraryMaintenanceSection';
import { ForgeSection } from './ForgeSection';
import { OutputMetadataSection } from './OutputMetadataSection';

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
        <ModelsSection online={online} />
        <PlaybackExportSection />
        <VoiceManagementSection />
        <LibraryMaintenanceSection />
        <ForgeSection />
        <OutputMetadataSection />
      </ScrollArea>
    </div>
  );
}
