/** The cut hint in a CHECK FAILED and what FILL types (F-030 #2, mockup frame 11, Q-048). */
import { describe, expect, it } from 'vitest';
import { fillLabel, fillRequest, limitHint } from './scoreLimitHint';

const SERVER = 'estimated 367 s: over the 360 s limit; cut the outro 0:11 to fit (section 4), or at least 68 BPM fits';

describe('limitHint: the server limit line read back', () => {
  it('turns the line naming a section into a title, a body and the words FILL types', () => {
    expect(limitHint(SERVER)).toEqual({
      title: 'OVER THE 360 s LIMIT BY 7 s',
      body: 'est 367 s · cut the outro 0:11 to fit (section 4) · or at least 68 BPM fits',
      fill: 'cut the outro',
    });
    expect(limitHint('estimated 1,385 s: over the 360 s limit; cut the pre-chorus 1:02 to fit (section 12)')?.fill).toBe('cut the pre-chorus');
    expect(fillLabel('cut the outro')).toBe('FILL “cut the outro”');
  });

  it('is null when no section is named, and for any other reason (those stay plain lines)', () => {
    expect(limitHint('estimated 458 s: over the 360 s limit; at least 112 BPM fits')).toBeNull();
    expect(limitHint('estimated 458 s: over the 360 s limit')).toBeNull();
    expect(limitHint('312 tokens over the 4,096 limit')).toBeNull();
  });
});

describe('fillRequest: FILL only types into the request', () => {
  it('adds the words after the request, once', () => {
    expect(fillRequest('play the last chorus three times', 'cut the outro')).toBe('play the last chorus three times, cut the outro');
    expect(fillRequest('play the last chorus three times.  ', 'cut the outro')).toBe('play the last chorus three times, cut the outro');
    expect(fillRequest('repeat the chorus, cut the outro', 'cut the outro')).toBe('repeat the chorus, cut the outro');
  });

  it('fills an empty request with the words alone', () => {
    expect(fillRequest('  ', 'cut the outro')).toBe('cut the outro');
  });
});
