import { useState } from 'react';
import type { Song } from './api';
import { useCreateDraftStore } from './createDraftStore';
import { Dropzone } from './Dropzone';
import { AudioPreview } from './AudioPreview';
import { AudioPreviewPopover } from './AudioPreviewPopover';
import { useObjectUrl } from './useObjectUrl';
import { ReusedSourceNote } from './ReusedSourceNote';

/** COVER's SOURCE block: UPLOAD or FROM LIBRARY, writing into the draft's audio slice.
 * `satisfied` says whether the draft already has what the tab needs to go on, so a reused
 * draft's "pick a new source" note clears. `lockedBy` names a job reading the source, which
 * holds it still until done (PLAN.md "COVER's Source Holds Still While a Job Reads It"). */
export function CoverSourcePicker({ songs, satisfied, lockedBy = null }: { songs: Song[]; satisfied: boolean; lockedBy?: string | null }) {
  const { source, selectedSongId, uploadFile } = useCreateDraftStore((s) => s.audio);
  const reusedFrom = useCreateDraftStore((s) => s.reusedFrom);
  const patchAudio = useCreateDraftStore((s) => s.patchAudio);
  const [librarySearch, setLibrarySearch] = useState('');
  const uploadUrl = useObjectUrl(uploadFile);
  const visibleLibrary = songs.filter((s) => s.title.toLowerCase().includes(librarySearch.toLowerCase()));
  const locked = !!lockedBy;

  return (
    <>
      <div className="section-label">SOURCE</div>
      <ReusedSourceNote title={reusedFrom} satisfied={satisfied} />
      {locked && <div className="hint">SOURCE is locked while {lockedBy} runs — its result belongs to this source</div>}
      <div className="type-tabs">
        <button className={source === 'upload' ? 'tab active' : 'tab'} disabled={locked} onClick={() => patchAudio({ source: 'upload' })}><span>UPLOAD</span></button>
        <button className={source === 'library' ? 'tab active' : 'tab'} disabled={locked} onClick={() => patchAudio({ source: 'library' })}><span>FROM LIBRARY</span></button>
      </div>
      {source === 'upload' ? (
        <>
          <Dropzone accept="audio/*" disabled={locked} onFile={(f) => patchAudio({ uploadFile: f })}>
            {uploadFile ? uploadFile.name : 'drag audio file here or click to browse'}
          </Dropzone>
          {uploadFile && uploadUrl && <AudioPreview src={uploadUrl} label={uploadFile.name} height={26} />}
        </>
      ) : (
        <div className="song-picker">
          <input placeholder="Search your library…" value={librarySearch} onChange={(e) => setLibrarySearch(e.target.value)} />
          <div className="song-picker-list">
            {visibleLibrary.map((s) => (
              <div key={s.id} className={`song-pick${s.id === selectedSongId ? ' current' : ''}${locked ? ' disabled' : ''}`}
                onClick={() => !locked && patchAudio({ selectedSongId: s.id })}>
                {s.audio_file && (
                  <AudioPreviewPopover src={`/audio/${s.audio_file}`} label={s.title} duration={s.duration ?? undefined} />
                )}
                <span className="song-pick-title">{s.title}</span>
              </div>
            ))}
            {visibleLibrary.length === 0 && <div className="empty">No songs match.</div>}
          </div>
        </div>
      )}
    </>
  );
}
