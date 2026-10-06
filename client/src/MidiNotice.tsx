import { useMidiNotice } from './scoreMidi';

/** The palette's .abc → MIDI conversion has no panel of its own, so its failure shows here. */
export function MidiNotice() {
  const { error, setError } = useMidiNotice();
  if (!error) return null;
  return (
    <div className="error midi-notice" role="alert">
      <span>{error}</span>
      <button type="button" onClick={() => setError('')}>DISMISS</button>
    </div>
  );
}
