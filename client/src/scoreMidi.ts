/** Saving a YuE2 score as a .mid (PLAN.md "Export a Score as MIDI"): from the open song, a
 * cover's score in Create, or an .abc file picked from the palette. */
import { create } from 'zustand';
import { api } from './api';
import { saveBlob } from './mixExport';

/** `name` without an .abc/.txt extension, as a .mid. */
export function midiFilename(name: string): string {
  const stem = name.trim().replace(/\.(abc|txt)$/i, '').trim();
  return `${stem || 'score'}.mid`;
}

export async function downloadScoreMidi(abc: string, name: string): Promise<void> {
  saveBlob(await api.scoreMidi(abc), midiFilename(name));
}

export async function downloadSongScoreMidi(songId: string, title: string): Promise<void> {
  saveBlob(await api.songScoreMidi(songId), midiFilename(title));
}

/** Why the palette's file conversion failed; shown by MidiNotice until dismissed. */
export const useMidiNotice = create<{ error: string; setError: (error: string) => void }>((set) => ({
  error: '',
  setError: (error) => set({ error }),
}));

/** The palette's "Convert an .abc file to MIDI": the file picker is the confirmation. */
export function convertAbcFile(): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.abc,.txt,text/plain';
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    const { setError } = useMidiNotice.getState();
    setError('');
    try {
      await downloadScoreMidi(await file.text(), file.name);
    } catch (err) {
      setError(`${file.name} is not a YuE2 score: ${err instanceof Error ? err.message : String(err)}`);
    }
  };
  input.click();
}
