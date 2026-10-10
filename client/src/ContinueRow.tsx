import { useEffect, useState } from 'react';
import { api, type RecentSong } from './api';
import { songActivity } from './continueActivity';
import { isDraftEmpty, useCreateDraftStore } from './createDraftStore';
import { START_FROM } from './createDraft';
import { useEditorJobStore } from './editorJobStore';
import { PlayerWaveform } from './PlayerWaveform';
import { useQueueStore } from './queueStore';
import { lastAction } from './recentSongs';

const MAX_ITEMS = 3;

interface Props {
  /** Re-read when this changes (the Library's song list was refreshed). */
  refreshKey: unknown;
  openEditor: (songId: string) => void;
  resumeCreate: () => void;
}

/** CONTINUE (PLAN.md "UI Redesign", S3.6): the songs edited last, newest first, with a draft in
 * Create ahead of them, each naming what is still open on it (PLAN.md "The other screens"). Hidden
 * on an empty library. */
export function ContinueRow({ refreshKey, openEditor, resumeCreate }: Props) {
  const [recent, setRecent] = useState<RecentSong[]>([]);
  const draftEmpty = useCreateDraftStore(isDraftEmpty);
  const draftTitle = useCreateDraftStore((s) => (s.titleSuggested ? '' : s.title));
  const draftType = useCreateDraftStore((s) => s.genType);
  const draftPrompt = useCreateDraftStore((s) => s.prompt);
  const running = useQueueStore((s) => s.running);
  const queued = useQueueStore((s) => s.queued);
  const split = useEditorJobStore((s) => s.splitJob);

  useEffect(() => {
    let live = true;
    api.recentSongs(MAX_ITEMS).then((r) => { if (live) setRecent(r); }).catch(() => {});
    return () => { live = false; };
  }, [refreshKey]);

  if (recent.length === 0) return null;
  const songs = recent.slice(0, draftEmpty ? MAX_ITEMS : MAX_ITEMS - 1);

  return (
    <section className="continue" aria-label="Continue">
      <span className="continue-label">CONTINUE</span>
      <div className="continue-grid">
        {!draftEmpty && (
          <div className="continue-card">
            <div className="continue-card-head">
              <span className="continue-title">{draftTitle || 'New song'}</span>
            </div>
            <div className="continue-draft-note">{draftPrompt || 'no description yet'}</div>
            <div className="continue-card-foot">
              <span className="continue-meta">Draft in Create · {START_FROM[draftType].title}</span>
              <button type="button" className="continue-resume" onClick={resumeCreate}><span>RESUME</span></button>
            </div>
          </div>
        )}
        {songs.map((r) => (
          <div key={r.id} className="continue-card">
            <div className="continue-card-head">
              <span className="continue-title">{r.title}</span>
              <span className="continue-badge"><span>v{r.layer_versions}</span></span>
            </div>
            {r.audio_file && (
              <PlayerWaveform
                audioUrl={`/audio/${r.audio_file}`} duration={r.duration ?? 0} playhead={0} height={30}
                showPlayhead={false} onClickOverride={() => openEditor(r.id)}
              />
            )}
            {songActivity(r.id, running, queued, split).map((doing) => (
              <div key={doing} className="continue-doing">{doing}</div>
            ))}
            <div className="continue-card-foot">
              <span className="continue-meta">{lastAction(r)}</span>
              <button type="button" className="continue-resume" onClick={() => openEditor(r.id)}>
                <span>RESUME</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
