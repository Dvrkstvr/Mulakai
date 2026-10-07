/** CR-7b's copy in `chatReferenceCopy.ts` (F-062..F-064; chat-reference.html 3a, 3b, 4a; D-141): the cover and borrow
 * card lines, a missing field's AUTO value and warn line, the A/B pill's status. */
import { describe, expect, it } from 'vitest';
import {
  AB_LISTENING, BORROW_HINT, COVER_HEADER, COVER_HINT, MISSING_BODY, autoValue, borrowConsequence, missingTitle,
} from './chatReferenceCopy';

describe('chatReferenceCopy (cover card, borrowed fields, A/B)', () => {
  it('the cover card says what it is and that nothing runs yet', () => {
    expect(COVER_HEADER).toBe('PROPOSAL · COVER');
    expect(COVER_HINT).toBe('nothing runs yet');
    expect(BORROW_HINT).toBe('borrows from the reference');
  });

  it('a missing key reads KEY · AUTO with a warn line; the model never fills it (F-064 edge)', () => {
    expect(autoValue('key')).toBe('KEY · AUTO');
    expect(autoValue('bpm')).toBe('TEMPO · AUTO');
    expect(autoValue('timeSignature')).toBe('METER · AUTO');
    expect(missingTitle('key')).toBe('NO KEY FOUND');
    expect(missingTitle('bpm')).toBe('NO TEMPO FOUND');
    expect(MISSING_BODY).toBe('in the reference · left blank, YuE2 decides when it renders');
  });

  it('CREATE SONG on a borrow names what came from the reference and that words and melody are new', () => {
    expect(borrowConsequence(190, ['bpm', 'timeSignature', 'structure'])).toBe(
      'Renders a new song on YuE2, about 3 min · tempo, meter and structure from the reference, words and melody are new · lands in Library',
    );
    expect(borrowConsequence(null, ['bpm'], 1)).toBe(
      'Renders a new song on YuE2 · tempo from the reference, words and melody are new · lands in Library · starts after 1 job',
    );
    expect(borrowConsequence(null, [])).toBe('Renders a new song on YuE2 · words and melody are new · lands in Library');
  });

  it('the A/B status while the reference plays', () => {
    expect(AB_LISTENING).toBe('LISTENING · SAME SECONDS');
  });
});
