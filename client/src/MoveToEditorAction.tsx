import { useState } from 'react';
import { api } from './api';
import { useNavigation } from './Navigation';
import { useCreateDraftStore } from './createDraftStore';
import { importFields } from './songImport';
import { readDuration } from './audioDuration';

/**
 * AUDIO tab escape hatch from generation: adds the uploaded file to the library *as a song*
 * and opens it in the editor, so a track you already have can be repainted and layered
 * without ACE-Step re-rendering it first (see PLAN.md's "Import a Song").
 *
 * Acid-outline, not acid-filled: it commits something, but GENERATE COVER is this region's
 * one filled CTA per DESIGN.md's one-filled-acid-CTA rule. Deliberately *not* disabled while
 * a generation runs elsewhere — importing takes no genLock because it renders nothing.
 */
export function MoveToEditorAction({ file }: { file: File }) {
  const { openEditor } = useNavigation();
  const draft = useCreateDraftStore();
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');

  const move = async () => {
    setError('');
    setImporting(true);
    try {
      const song = await api.importSong(file, importFields(draft, await readDuration(file)));
      openEditor(song.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setImporting(false);
    }
  };

  const carried = [
    draft.prompt.trim() && 'prompt',
    draft.lyrics.trim() && 'lyrics',
    draft.bpm > 0 && 'BPM',
    !!draft.keyScale && 'key',
  ].filter(Boolean) as string[];

  return (
    <div className="move-to-editor">
      <button className="acid-outline" disabled={importing} onClick={move}>
        <span>{importing ? 'IMPORTING…' : 'MOVE TO EDITOR'}</span>
      </button>
      <div className="hint">
        Saves &ldquo;{file.name}&rdquo; to your library as a new song{draft.folderName ? ` in ${draft.folderName}` : ''} and
        opens it for repaint and Add Layer. Nothing is generated — the audio is kept exactly as uploaded
        {carried.length > 0 ? `, with the ${carried.join(', ')} above` : ''}.
      </div>
      {error && <div className="error">{error} <button onClick={move}>RETRY</button></div>}
    </div>
  );
}
