import { useState } from 'react';
import { useCreateDraftStore, isDraftEmpty } from './createDraftStore';
import { useVoiceStore } from './voiceStore';

/** Start the draft over. Two-step, like FEELING LUCKY's overwrite confirm (PromptGenerateRow)
 * and the Library's delete confirms — the armed state says what will go before it goes, per
 * DESIGN.md's rule that destructive actions state their consequence inline.
 *
 * One button for the whole draft rather than a per-field "clear prompt": the tabs share one
 * intent now, so clearing a single field would leave the rest of a half-abandoned draft behind
 * for the user to hunt down. The destination folder survives — it came from where you were in
 * the Library, not from anything you typed. */
export function ClearDraftButton({ disabled }: { disabled: boolean }) {
  const [confirm, setConfirm] = useState(false);
  const empty = useCreateDraftStore(isDraftEmpty);
  const clear = useCreateDraftStore((s) => s.clear);
  // Derived, not stored: an armed button whose draft empties by some other route (or while a
  // generation starts) must not stay armed, and adjusting state during render to fix that up
  // is worse than just not trusting the flag on its own.
  const armed = confirm && !empty && !disabled;

  const onClick = () => {
    if (!armed) { setConfirm(true); return; }
    setConfirm(false);
    clear();
    useVoiceStore.getState().clearReference();
  };

  return (
    <div className="clear-draft">
      {armed && (
        <span className="hint">
          Clears the prompt, lyrics, song details, each tab&#39;s source and the reference audio.
        </span>
      )}
      <button
        className={armed ? 'clear-draft-btn armed' : 'clear-draft-btn'}
        disabled={disabled || empty}
        onClick={onClick}
        onBlur={() => setConfirm(false)}
      >
        {armed ? 'CLEAR ALL? CONFIRM' : 'CLEAR DRAFT'}
      </button>
    </div>
  );
}
