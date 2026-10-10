import { useEffect, useState } from 'react';
import { api, type Layer } from './api';
import { useEditorJobStore } from './editorJobStore';
import { queueSuffix } from './queueCopy';
import { useJobsAhead } from './queueStore';
import { useLookup } from './lookup';
import { SplitBackendTabs } from './SplitBackendTabs';
import { DockCommit } from './DockCommit';

interface Props {
  songId: string;
  layer: Layer;
}

/**
 * SPLIT — pick a backend and start extracting stems from the focused layer. Once it starts, the stems open in a tray
 * under that layer's lane (SplitTray, PLAN.md "Editor Redesign", PR 9), where they are kept, used, downloaded or
 * re-extracted; this body then only points there. One split is open at a time.
 */
export function DockSplit({ songId, layer }: Props) {
  const [model, setModel] = useState<'acestep' | 'demucs' | null>(null);
  const ahead = useJobsAhead();
  const splitJob = useEditorJobStore((s) => s.splitJob);
  const startSplit = useEditorJobStore((s) => s.startSplit);
  const mine = splitJob?.layerId === layer.id ? splitJob : null;
  const open = !!mine && mine.stage !== 'failed'; // a failed start offers SPLIT again
  const otherSplit = splitJob && !mine ? splitJob : null;
  // A busy GPU doesn't hold SPLIT (the server queues it). The one open split session does: a
  // start here would close another layer's session while its stems are still extracting.
  const otherExtracting = otherSplit?.stage === 'running' ? otherSplit : null;

  const healthLookup = useLookup(api.splitHealth);
  const health = healthLookup.data;

  useEffect(() => {
    if (model || !health) return;
    if (health.acestep) setModel('acestep');
    else if (health.demucs) setModel('demucs');
  }, [health, model]);

  const canSubmit = !!model && !!health?.[model] && !open && !otherExtracting;

  if (open) {
    return (
      <div className="dock-body split-panel">
        <div className="hint">the stems of {layer.name.toUpperCase()} are open under its lane above · keep, use or download them there</div>
      </div>
    );
  }
  return (
    <>
      <div className="dock-body split-panel">
        <SplitBackendTabs lookup={healthLookup} model={model} onPick={setModel} />
      </div>
      <DockCommit
        consequence={otherExtracting
          ? "one split is open at a time — another layer's stems are still extracting · CLOSE it under that lane first, or wait for them"
          : `extracts vocals, drums, bass and other as stems from ${layer.name.toUpperCase()}, shown under its lane${queueSuffix(ahead)}`}
        label={`SPLIT ${layer.name.toUpperCase()}`}
        disabled={!canSubmit}
        onCommit={() => { if (canSubmit && model) void startSplit(layer.id, songId, model); }}
      />
      {!otherExtracting && otherSplit?.stage === 'done' && <div className="hint">starting closes the open split on another layer — its unkept stems are discarded</div>}
    </>
  );
}
