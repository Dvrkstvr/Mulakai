import { useState } from 'react';
import { ApiError, type SongDetail } from './api';
import { DockCommit } from './DockCommit';
import { downloadSongScoreMidi, midiFilename } from './scoreMidi';

/** EXPORT › SCORE AS MIDI (PLAN.md "Export a Score as MIDI"): the active take's YuE2 score. */
export function DockExportMidi({ song }: { song: SongDetail }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await downloadSongScoreMidi(song.id, song.title);
    } catch (err) {
      setError(err instanceof ApiError && err.status === 404
        ? 'this take has no score — an ACE-Step edit replaced the one YuE2 made'
        : err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <DockCommit
        consequence={`Downloads ${midiFilename(song.title)} · the score's Vocal and Ins melodies, not the audio · chords left out`}
        label={saving ? 'CONVERTING…' : 'DOWNLOAD MIDI'}
        disabled={saving}
        onCommit={() => void save()}
      />
      {error && <div className="error">{error} <button onClick={() => void save()}>RETRY</button></div>}
    </>
  );
}
