import { describe, it, expect } from 'vitest';
import { captionToStyleTags } from './styleTags';

describe('captionToStyleTags', () => {
  it('rewrites ACE-Step prose into voice, genre, mood, instrument and trait tags', () => {
    const caption = 'A melancholic Latin trap track built on a foundation of deep 808 sub-bass and crisp, rolling '
      + 'hi-hats from a drum machine. A somber synth pad provides an atmospheric backdrop for the emotional male lead '
      + 'vocal, which is treated with noticeable auto-tune and spacious reverb.';
    expect(captionToStyleTags(caption)).toEqual([
      'emotional male vocal', 'latin trap', 'melancholic', 'somber',
      'deep 808 sub-bass', 'rolling hi-hats', 'drum machine', 'synth pad', 'auto-tune',
    ]);
  });

  it('reads a phrase from its last word, keeping up to two modifiers', () => {
    expect(captionToStyleTags('Driven by a funky synth bassline and rhythmic electric guitar chords.'))
      .toEqual(['funky synth bassline', 'rhythmic electric guitar']);
  });

  it('writes the voice as upstream does: adjectives, gender, "vocal"', () => {
    expect(captionToStyleTags('A smooth tenor delivered by a warm, breathy female vocalist.')).toEqual(['breathy female vocal']);
    expect(captionToStyleTags('Interweaving male and female vocals over piano.')).toEqual(['male and female vocals', 'piano']);
    expect(captionToStyleTags('A trap song with aggressive male rap and heavy 808s.'))
      .toEqual(['aggressive male rap', 'trap', 'heavy 808s']);
  });

  it('keeps a bare rap as a trait and drops a bare lead vocal', () => {
    expect(captionToStyleTags('The lead vocal floats over rap verses and piano.')).toEqual(['piano', 'rap']);
  });

  it('takes any -pop / -rock / -hop compound as a genre', () => {
    expect(captionToStyleTags('An upbeat Brazilian samba-pop song, with J-rock energy.'))
      .toEqual(['brazilian samba-pop', 'j-rock', 'upbeat']);
  });

  it('drops a tag a more specific one already says', () => {
    expect(captionToStyleTags('An explosive pop-rock track over a rock beat, piano and a bright piano melody.'))
      .toEqual(['pop-rock', 'explosive', 'bright piano']);
  });

  it('skips what the caption says is absent', () => {
    expect(captionToStyleTags('A calm ambient piece with soft piano and no drums.')).toEqual(['ambient', 'calm', 'soft piano']);
  });

  it('caps each kind, in the order the caption mentions them', () => {
    const tags = captionToStyleTags('A pop, rock, jazz and folk song: happy, sad, calm. Piano, organ, harp, flute and cello.');
    expect(tags).toEqual(['pop', 'rock', 'happy', 'sad', 'piano', 'organ', 'harp', 'flute']);
  });

  it('never carries tempo, key, meter or language from prose', () => {
    expect(captionToStyleTags('A mid-tempo Mandopop ballad in 3/4 time at 96 BPM in C major, sung in Mandarin.'))
      .toEqual(['mandopop', 'ballad']);
  });

  it('keeps a caption that is already a tag list, minus what a cover cannot use', () => {
    expect(captionToStyleTags('English, warm female vocal, contemporary pop, 96 BPM, C major, 4/4, piano, restrained drums'))
      .toEqual(['warm female vocal', 'contemporary pop', 'piano', 'restrained drums']);
  });

  it('is empty when nothing is recognised, so the caller keeps the prose', () => {
    expect(captionToStyleTags('Something hard to put into words.')).toEqual([]);
    expect(captionToStyleTags('')).toEqual([]);
  });
});
