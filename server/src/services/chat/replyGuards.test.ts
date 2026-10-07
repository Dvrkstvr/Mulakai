import { describe, it, expect, vi } from 'vitest';
import { contract } from '../../../test-fakes/fakeYue.js';
import { lyricLanguageReasons, missingSectionReasons, sayKeyReasons } from './replyGuards.js';
import type { ApplyResult, ScoreFacts } from '../score/planTypes.js';

const facts = contract('read-ok').response.body.facts as ScoreFacts; // sections intro, verse, chorus, outro; K:Dm
const withKey = (key: string): ScoreFacts => ({ ...facts, header: { ...facts.header, key } });

describe('guard: a section the request names but the song lacks (SP-5 v3)', () => {
  it('rejects with "answer say, tell what the song has" (the spike\'s wording)', () => {
    expect(missingSectionReasons('repeat the bridge', facts)).toEqual([
      'the request names the bridge, but this song has no bridge (its sections: chorus, intro, outro, verse): do not substitute another '
      + 'place; answer with action say and tell the person what the song has instead',
    ]);
  });

  it('passes a section the song has, and a request that names none', () => {
    expect(missingSectionReasons('give the Chorus jazz chords', facts)).toEqual([]);
    expect(missingSectionReasons('slow it down a little', facts)).toEqual([]);
  });

  it('a song with no marked sections says so', () => {
    expect(missingSectionReasons('cut the intro', { ...facts, sections: [] })[0]).toContain('(its sections: none marked)');
  });
});

describe('guard: a say naming a key other than the HEADER\'s (SP-5 v3.1)', () => {
  it('MT03.t3: "Gm (G minor)" after a TRANSPOSE to Fm is rejected with the HEADER key', () => {
    expect(sayKeyReasons('The song is now in the key of Gm (G minor).', withKey('Fm'))).toEqual([
      'you named the key G minor, but the HEADER says K:Fm (F minor) for the active version: quote the HEADER',
    ]);
  });

  it('passes the right key, in any of its spellings, and a message that names no key', () => {
    expect(sayKeyReasons('The song is now in the key of Fm (F minor), as stated in the HEADER.', withKey('Fm'))).toEqual([]);
    expect(sayKeyReasons('It is in B♭ minor.', withKey('Bbm'))).toEqual([]);
    expect(sayKeyReasons('It is at 87 BPM.', facts)).toEqual([]);
  });

  it('a major key: "D minor" is wrong for K:D, "F# major" is right for K:F#', () => {
    expect(sayKeyReasons('It is in D minor.', withKey('D'))[0]).toContain('the HEADER says K:D (D major)');
    expect(sayKeyReasons('It is in F# major.', withKey('F#'))).toEqual([]);
    expect(sayKeyReasons('It is in F major.', withKey('F#'))[0]).toContain('you named the key F major');
  });
});

describe('guard: a rewritten lyric block keeps the language of the block it replaces (SP-5 v3)', () => {
  const applied = (oldLines: string[], newLines: string[]) => ({
    verdicts: [{ index: 2, op: 'REWRITE_LYRICS', ok: true, reason: null, diff: { block: 5, tag: '[Chorus]', occurrence: 2, old: oldLines, new: newLines } }],
  }) as unknown as ApplyResult;
  const de = ['Der Tag ist still, das Licht so schwach', 'die Worte fehlen mir, ich kann nicht sprechen'];
  const en = ['The day is still, the light is weak', 'the words are gone, I cannot speak at all'];
  const detect = vi.fn(async (t: string) => (t.startsWith('Der') ? 'de' : 'en'));

  it('English lines for a German block are rejected, naming the op and the language', async () => {
    expect(await lyricLanguageReasons(applied(de, en), detect)).toEqual([
      'op 2 (REWRITE_LYRICS): the new lines read as \'en\' but the block they replace reads as \'de\': write them in the song\'s own language (\'de\')',
    ]);
  });

  it('the same language passes; text of 40 characters or less is not judged', async () => {
    expect(await lyricLanguageReasons(applied(de, de), detect)).toEqual([]);
    detect.mockClear();
    expect(await lyricLanguageReasons(applied(['Ooh la la'], en), detect)).toEqual([]);
    expect(detect).not.toHaveBeenCalled();
  });

  it('an undecided language passes', async () => {
    expect(await lyricLanguageReasons(applied(de, en), async () => null)).toEqual([]);
  });
});
