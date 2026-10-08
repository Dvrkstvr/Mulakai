import type { Dispatch } from 'react';
import type { BpmEvent, BpmField } from './bpmField';

/** BPM… (D-211): a choice chip that turns into its own text input in place, focused, with only an enter icon.
 * The state lives in `bpmField`; this only draws it and forwards the events. */
export function BpmChip({ state, dispatch, disabled }: { state: BpmField; dispatch: Dispatch<BpmEvent>; disabled?: boolean }) {
  if (state.kind !== 'open') {
    const locked = state.kind === 'locked';
    return (
      <button type="button" role="radio" aria-checked={locked} disabled={disabled}
        className={`tab dock-chip${locked ? ' active' : ''}`} onClick={() => dispatch({ type: 'open' })}>
        <span>{locked ? `${state.bpm} BPM` : 'BPM…'}</span>
      </button>
    );
  }
  return (
    <span className={`bpm-field${state.why ? ' bad' : ''}`}>
      {/* eslint-disable-next-line jsx-a11y/no-autofocus -- D-211: the chip becomes the field and takes focus */}
      <input autoFocus inputMode="numeric" placeholder="BPM" aria-label="BPM" value={state.text}
        onChange={(e) => dispatch({ type: 'type', text: e.target.value })}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); dispatch({ type: 'enter' }); }
          if (e.key === 'Escape') dispatch({ type: 'leave' });
        }}
        onBlur={() => dispatch({ type: 'leave' })} />
      <button type="button" className="bpm-enter" aria-label="Lock the BPM" title="Enter"
        onMouseDown={(e) => e.preventDefault()} onClick={() => dispatch({ type: 'enter' })}>↵</button>
    </span>
  );
}
