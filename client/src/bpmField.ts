/** BPM… as its own input (owner, D-211; design/retime.html A′1-A′5): the chip turns into a focused text field in
 * place; a click outside (or Esc) turns it back into the chip with no BPM set; Enter, or the field's ↵ icon,
 * locks the BPM; a locked BPM is the picked mode. Enter on an empty or out-of-range value does not lock: the field
 * stays open with the reason. Clicking a locked chip opens it again with its value. Pure reducer. */
import { readTypedBpm } from './retimeRules';

export type BpmField =
  | { kind: 'chip' }
  | { kind: 'open'; text: string; why: string | null }
  | { kind: 'locked'; bpm: number };

export type BpmEvent =
  | { type: 'open' }
  | { type: 'type'; text: string }
  | { type: 'enter' }
  | { type: 'leave' } // a click outside, or Esc
  | { type: 'reset' }; // another mode was picked

export const BPM_CHIP: BpmField = { kind: 'chip' };

export function bpmField(state: BpmField, event: BpmEvent): BpmField {
  switch (event.type) {
    case 'open':
      return state.kind === 'open' ? state : { kind: 'open', text: state.kind === 'locked' ? String(state.bpm) : '', why: null };
    case 'type':
      return state.kind === 'open' ? { kind: 'open', text: event.text.replace(/\D/g, '').slice(0, 3), why: null } : state;
    case 'enter': {
      if (state.kind !== 'open') return state;
      const read = readTypedBpm(state.text);
      return 'bpm' in read ? { kind: 'locked', bpm: read.bpm } : { ...state, why: read.why };
    }
    case 'leave':
      return state.kind === 'open' ? BPM_CHIP : state;
    case 'reset':
      return BPM_CHIP;
  }
}
