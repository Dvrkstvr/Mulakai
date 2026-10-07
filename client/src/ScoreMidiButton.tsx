import { useState } from 'react';
import { downloadScoreMidi } from './scoreMidi';

interface Props {
  abc: string;
  /** Where the score came from (a song title, a file name): the .mid is named after it. */
  name: string;
  disabled: boolean;
  onError: (message: string) => void;
}

/** A cover's score in Create, saved as a .mid (PLAN.md "Export a Score as MIDI"). */
export function ScoreMidiButton({ abc, name, disabled, onError }: Props) {
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    onError('');
    try {
      await downloadScoreMidi(abc, name);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };
  return (
    <button type="button" className="tag-guide-btn" disabled={disabled || saving} onClick={() => void save()}>
      <span>{saving ? 'CONVERTING…' : 'DOWNLOAD MIDI'}</span>
    </button>
  );
}
