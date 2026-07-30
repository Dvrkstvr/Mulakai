import { describe, it, expect } from 'vitest';
import { importFields, type ImportDraft } from './songImport';

const EMPTY: ImportDraft = { title: '', prompt: '', lyrics: '', bpm: 0, keyScale: '', duration: 0 };

describe('importFields', () => {
  it('sends nothing for an untouched draft, leaving the server fallbacks to apply', () => {
    expect(importFields(EMPTY)).toEqual({});
  });

  it('carries everything the AUDIO tab can have filled in', () => {
    expect(importFields({
      title: 'My Track', prompt: 'lofi hip hop', lyrics: '[verse]', bpm: 128,
      keyScale: 'A minor', duration: 200, folderId: 'f1',
    })).toEqual({
      title: 'My Track', prompt: 'lofi hip hop', lyrics: '[verse]', bpm: '128',
      key_scale: 'A minor', duration: '200', folder_id: 'f1',
    });
  });

  it('prefers the measured file duration over the draft target length', () => {
    expect(importFields({ ...EMPTY, duration: 240 }, 212.5).duration).toBe('212.5');
  });

  it('falls back to the draft duration when the file could not be measured', () => {
    expect(importFields({ ...EMPTY, duration: 240 }, undefined).duration).toBe('240');
  });

  // 0/'' mean AUTO in the draft, not "known to be zero" — sending them would persist a
  // bpm of 0 onto the song and stamp it into the output file's tags.
  it('omits AUTO placeholders rather than sending 0/empty', () => {
    const fields = importFields({ ...EMPTY, bpm: 0, keyScale: '', duration: 0 });
    expect(fields).not.toHaveProperty('bpm');
    expect(fields).not.toHaveProperty('key_scale');
    expect(fields).not.toHaveProperty('duration');
  });

  it('omits a whitespace-only title so the filename is used instead', () => {
    expect(importFields({ ...EMPTY, title: '   ' })).not.toHaveProperty('title');
  });

  it('trims the title but leaves prompt and lyrics byte-for-byte', () => {
    const fields = importFields({ ...EMPTY, title: '  Padded  ', prompt: ' spaced ', lyrics: '\n[verse]\n' });
    expect(fields.title).toBe('Padded');
    expect(fields.prompt).toBe(' spaced ');
    expect(fields.lyrics).toBe('\n[verse]\n');
  });

  it('omits a blank folder destination', () => {
    expect(importFields({ ...EMPTY, folderId: undefined })).not.toHaveProperty('folder_id');
  });
});
