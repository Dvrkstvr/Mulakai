import { useEffect, useMemo, useRef, useState } from 'react';
import { api, type Song, type RefineResult } from './api';
import { SettingsPanel } from './SettingsPanel';
import { RefineRail } from './RefineRail';
import { useVoiceStore } from './voiceStore';
import { useHeaderSlot } from './HeaderSlot';
import { ScrollArea } from './ScrollArea';
import { useCreateDraftStore } from './createDraftStore';
import { CreateAudioTab } from './CreateAudioTab';
import { CreateArrangeTab } from './CreateArrangeTab';
import { CreatePromptTab } from './CreatePromptTab';
import { AutoTextarea } from './AutoTextarea';
import { useResizableWidth } from './useResizableWidth';
import { ResizeHandle } from './ResizeHandle';

/** Dedicated Create takeover — reached from the Library create bar or the Library detail
 * rail's REUSE PROMPT / CREATE COVER FROM AUDIO actions, per docs/design/DESIGN.md.
 * Submitting a generation hands it off to generationStore.ts and returns to the library
 * immediately — the library's GeneratingCard tracks it to completion from there, so only one
 * generation can ever be in flight globally.
 *
 * This is the shell only: tabs, title, destination, layout and the refine rail. The draft
 * itself lives in createDraftStore.ts (App.tsx loads it at navigation time), so the three
 * tabs — CreatePromptTab / CreateAudioTab / CreateArrangeTab — share one song intent and
 * switching between them no longer discards what you typed. */
export function CreateView({ songs, onBack }: { songs: Song[]; onBack: () => void }) {
  const draft = useCreateDraftStore();
  const { genType, title, folderId, folderName } = draft;
  const patch = draft.patch;

  const [refining, setRefining] = useState(false);
  const [refinePreview, setRefinePreview] = useState<RefineResult | null>(null);
  const [refineError, setRefineError] = useState('');

  // Prefills Title with "<Folder Name>" (or "<Folder Name> <n>" past the highest number
  // already used there) when Create was opened from/for a specific folder — still a plain
  // editable value, not a locked default. Skipped if the field already has content so it never
  // clobbers something the user already put there.
  useEffect(() => {
    if (!folderId || title) return;
    api.nextFolderTitle(folderId).then((r) => patch({ title: r.title })).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folderId]);

  // Re-apply a reused song's reference audio (voice + the influences it was rendered at).
  // Keyed on the draft's own values so a fresh draft re-runs it — including the no-reference
  // case, which clears any stale "voice missing" warning.
  useEffect(() => {
    void useVoiceStore.getState().restoreReference(
      draft.referenceLabel, draft.referenceAudioInfluence, draft.referenceStyleInfluence,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.referenceLabel, draft.referenceAudioInfluence, draft.referenceStyleInfluence]);

  const refine = async () => {
    setRefineError('');
    setRefining(true);
    try {
      setRefinePreview(await api.refineInput({
        prompt: draft.prompt, lyrics: draft.lyrics,
        ...(draft.bpm > 0 ? { bpm: draft.bpm } : {}),
        ...(draft.keyScale ? { key_scale: draft.keyScale } : {}),
        ...(draft.timeSignature ? { time_signature: draft.timeSignature } : {}),
        ...(draft.vocalLanguage ? { vocal_language: draft.vocalLanguage } : {}),
        ...(draft.duration > 0 ? { audio_duration: draft.duration } : {}),
      }));
    } catch (err) {
      setRefineError(err instanceof Error ? err.message : String(err));
    } finally {
      setRefining(false);
    }
  };

  const closeRefine = () => {
    setRefinePreview(null);
    setRefineError('');
  };

  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;
  const headerLeft = useMemo(() => <button onClick={() => onBackRef.current()}>&#8592; LIBRARY</button>, []);
  useHeaderSlot(headerLeft, null);

  const showRail = refining || !!refinePreview || !!refineError;
  const referenceAudioTaskType = genType === 'audio' ? 'cover' : genType === 'complete' ? 'complete' : 'text2music';

  const settingsWidth = useResizableWidth({ storageKey: 'mulakai:createSettingsWidth', default: 210, min: 180, max: 420, growsToward: 'right' });
  const railWidth = useResizableWidth({ storageKey: 'mulakai:createRailWidth', default: 300, min: 240, max: 520, growsToward: 'left' });
  const gridTemplateColumns = `${settingsWidth.width}px 1fr${showRail ? ` ${railWidth.width}px` : ''}`;

  return (
    <div className="create-shell">
      <div className={showRail ? 'with-panel create-layout with-rail' : 'with-panel create-layout'} style={{ gridTemplateColumns }}>
        <div className="resizable-col">
          <SettingsPanel mode="generate" hideLmControls={genType === 'audio'} referenceAudioTaskType={referenceAudioTaskType} />
          <ResizeHandle side="right" onPointerDown={settingsWidth.onPointerDown} />
        </div>
        <div className="create-panel">
          <ScrollArea className="create-content">
            <div className="section-label">GENERATION TYPE</div>
            <div className="type-tabs">
              <button className={genType === 'prompt' ? 'tab active' : 'tab'} onClick={() => patch({ genType: 'prompt' })}><span>PROMPT</span></button>
              <button className={genType === 'audio' ? 'tab active' : 'tab'} onClick={() => patch({ genType: 'audio' })}><span>COVER</span></button>
              <button className={genType === 'complete' ? 'tab active' : 'tab'} onClick={() => patch({ genType: 'complete' })}><span>ARRANGE</span></button>
            </div>

            {folderName && (
              <div className="folder-dest">
                <span className="section-label">Save To</span>
                <span className="dest-chip"><span className="lbl">&#9656; {folderName}</span></span>
              </div>
            )}

            <AutoTextarea placeholder="Title" value={title} onChange={(v) => patch({ title: v })} />

            {genType === 'prompt' && <CreatePromptTab refining={refining} onRefine={refine} onBack={onBack} />}
            {genType === 'audio' && <CreateAudioTab songs={songs} onBack={onBack} />}
            {genType === 'complete' && <CreateArrangeTab onBack={onBack} />}
          </ScrollArea>
        </div>
        {showRail && (
          <div className="resizable-col">
            <ResizeHandle side="left" onPointerDown={railWidth.onPointerDown} />
            <RefineRail
              refining={refining}
              preview={refinePreview}
              error={refineError}
              current={draft}
              onRefine={refine}
              onClose={closeRefine}
              onAccept={{
                prompt: (v) => patch({ prompt: v, formatted: true }),
                lyrics: (v) => patch({ lyrics: v, formatted: true }),
                bpm: (v) => patch({ bpm: v }),
                keyScale: (v) => patch({ keyScale: v }),
                timeSignature: (v) => patch({ timeSignature: v }),
                vocalLanguage: (v) => patch({ vocalLanguage: v }),
                duration: (v) => patch({ duration: v }),
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
