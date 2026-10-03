import { useEffect, useState } from 'react';
import type { SongDetail } from './api';
import { AudioPreview } from './AudioPreview';
import { RemasterAction } from './RemasterAction';
import { DockCommit } from './DockCommit';
import { useEditorJobStore, myEditorJobs } from './editorJobStore';
import { useRemasterResult } from './remasterResult';
import { audibleTakes } from './mix/activeLayers';
import { bounceAudible, mixFilename, saveBlob } from './mixExport';
import { useDockRequest, type ExportWhat } from './dockRequest';

const WHATS: { id: ExportWhat; label: string }[] = [
  { id: 'mix', label: 'MIX' }, { id: 'stems', label: 'STEMS' }, { id: 'remaster', label: 'REMASTERED MIX' },
];

/**
 * EXPORT: MIX (a client-side bounce of what you hear, untagged WAV), STEMS (each layer's active
 * take as stored), or REMASTERED MIX (one ACE-Step pass over the mix, never kept). Opens on
 * REMASTERED MIX while this song has a remaster running or held, so it isn't hidden behind MIX.
 */
export function DockExport({ song }: { song: SongDetail }) {
  const [what, setWhat] = useState<ExportWhat>(() => {
    const remastering = myEditorJobs(useEditorJobStore.getState().editorJobs, 'remaster', { songId: song.id }).length > 0;
    return remastering || useRemasterResult.getState().result?.songId === song.id ? 'remaster' : 'mix';
  });
  // A WHAT picked from outside the dock (the palette's "Export stems").
  const whatPick = useDockRequest((s) => s.exportWhat);
  useEffect(() => {
    if (whatPick === null) return;
    setWhat(whatPick);
    useDockRequest.setState({ exportWhat: null });
  }, [whatPick]);
  const [mixing, setMixing] = useState(false);
  const [mixError, setMixError] = useState('');
  const audible = audibleTakes(song.layers).length;

  const downloadMix = async () => {
    setMixing(true);
    setMixError('');
    try {
      saveBlob(await bounceAudible(song.layers), mixFilename(song.title));
    } catch (err) {
      setMixError(err instanceof Error ? err.message : String(err));
    } finally {
      setMixing(false);
    }
  };

  return (
    <>
      <div className="dock-body dock-export">
        <div className="dock-chips" role="radiogroup" aria-label="What to export">
          <span className="dock-row-label">WHAT</span>
          {WHATS.map((w) => (
            <button key={w.id} type="button" role="radio" aria-checked={w.id === what}
              className={`tab dock-chip${w.id === what ? ' active' : ''}`} onClick={() => setWhat(w.id)}>
              <span>{w.label}</span>
            </button>
          ))}
        </div>
        {what === 'mix' && <div className="hint">MIX follows mute/solo — what you hear is what you get</div>}
        {what === 'stems' && (
          <>
            <div className="hint">audition or download each layer's active version as a separate stem</div>
            {song.layers.map((layer) => {
              const active = layer.versions.find((v) => v.active);
              if (!active) return null;
              const ext = active.audio_file.slice(active.audio_file.lastIndexOf('.') + 1) || 'wav';
              return (
                <div key={layer.id} className="stem-row">
                  <div className="stem-row-head">
                    <span className="stem-name">{layer.name}</span>
                    <a className="link-btn stem-dl" href={`/audio/${active.audio_file}`} download={`${song.title} - ${layer.name}.${ext}`}>
                      <span>DOWNLOAD</span>
                    </a>
                  </div>
                  <AudioPreview src={`/audio/${active.audio_file}`} label={layer.name} height={24} />
                </div>
              );
            })}
          </>
        )}
      </div>
      {what === 'mix' && (
        <>
          <DockCommit
            consequence={`Downloads ${mixFilename(song.title)} · ${audible} layer${audible === 1 ? '' : 's'} mixed at their volumes · untagged 16-bit WAV`}
            label={mixing ? 'MIXING…' : 'DOWNLOAD MIX'}
            disabled={mixing || audible === 0}
            onCommit={() => void downloadMix()}
          />
          {mixError && <div className="error">{mixError} <button onClick={() => void downloadMix()}>RETRY</button></div>}
        </>
      )}
      {what === 'remaster' && <RemasterAction songId={song.id} layers={song.layers} />}
    </>
  );
}
