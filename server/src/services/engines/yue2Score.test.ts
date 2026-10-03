/** F-023 #1: the score render's YuE2 job body (D-010, D-023). */
import { describe, it, expect } from 'vitest';
import { buildYue2ScoreRequest } from './yue2Score.js';
import { buildYue2CoverRequest } from './yue2.js';

// Stored lyrics with the quirks D-023 protects: a numbered tag, a trailing space, CRLF, no final newline.
const LYRICS = '[Verse 1]\r\nwalking out \r\n\r\n[Chorus]\r\noh oh';
const EDITED = 'X:1\nM:4/4\nL:1/8\nQ:1/4=88\nK:Dm\n"Dm7"D2 F2 A2 c2 |\n';

describe('buildYue2ScoreRequest', () => {
  const body = buildYue2ScoreRequest({ abc: EDITED, style: 'English, jazz pop, 88 bpm', lyrics: LYRICS, seed: 2_147_483_901 });

  it('sends the edited score with cot full, the plan style, the stored lyrics and the base seed', () => {
    expect(body).toEqual({ abc: EDITED, cot: 'full', style: 'English, jazz pop, 88 bpm', lyrics: LYRICS, seed: 2_147_483_901 });
  });

  it('keeps the stored lyrics byte for byte (no tag normalising)', () => {
    expect(body.lyrics).toBe(LYRICS);
    expect(Buffer.from(body.lyrics).equals(Buffer.from(LYRICS))).toBe(true);
  });

  it('sends nothing the base request had beyond those five fields (no cfg, no id)', () => {
    expect(Object.keys(body).sort()).toEqual(['abc', 'cot', 'lyrics', 'seed', 'style']);
  });

  it('leaves the cover builder on cot melody', () => {
    const cover = buildYue2CoverRequest({ prompt: 'pop', lyrics: 'la', vocal_language: 'en', cot: 'full' }, EDITED, () => 7);
    expect(cover).toMatchObject({ cot: 'melody', abc: EDITED, seed: 7 });
  });
});
