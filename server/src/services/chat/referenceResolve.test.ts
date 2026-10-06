/** Which reference an `analyze` reply means (F-061): the message's attach first, then a title, exact then any case. */
import { describe, it, expect } from 'vitest';
import { resolveReference } from './referenceResolve.js';

const refs = [
  { id: 'r1', name: 'demo.mp3', sourceSongId: null },
  { id: 'r2', name: 'Kopf Hoch', sourceSongId: 's2' },
];
const library = [{ id: 's1', title: 'Luz sobre el mar' }, { id: 's2', title: 'Kopf Hoch' }, { id: 's3', title: 'Twice' }, { id: 's4', title: 'twice' }];
const base = { named: 'the attached file', attach: null, references: refs, library };

describe('resolveReference', () => {
  it("the user message's attach wins over any name", () => {
    expect(resolveReference({ ...base, named: 'Luz sobre el mar', attach: 'r1' })).toEqual({ referenceId: 'r1' });
  });

  it('an attach that is not this thread\'s is ignored', () => {
    expect(resolveReference({ ...base, named: 'Luz sobre el mar', attach: 'other' })).toEqual({ songId: 's1' });
  });

  it('an attached file named exactly, then a library title (quotes and case ignored on the second pass)', () => {
    expect(resolveReference({ ...base, named: 'demo.mp3' })).toEqual({ referenceId: 'r1' });
    expect(resolveReference({ ...base, named: 'Luz sobre el mar' })).toEqual({ songId: 's1' });
    expect(resolveReference({ ...base, named: '"luz SOBRE el mar"' })).toEqual({ songId: 's1' });
  });

  it('a library song already copied into this thread resolves to its copy', () => {
    expect(resolveReference({ ...base, references: [refs[0], { ...refs[1], name: 'renamed' }], named: 'Kopf Hoch' })).toEqual({ referenceId: 'r2' });
  });

  it('two matches at the same level: a reason, never a guess', () => {
    expect(resolveReference({ ...base, named: 'TWICE' })).toEqual({ reason: expect.stringContaining('2 songs') });
    expect(resolveReference({ ...base, named: 'Twice' })).toEqual({ songId: 's3' }); // exact beats any-case
  });

  it('no name matches: the only attached file, else a reason', () => {
    expect(resolveReference({ ...base, references: [refs[0]] })).toEqual({ referenceId: 'r1' });
    expect(resolveReference(base)).toEqual({ reason: expect.stringContaining('the attached file') });
    expect(resolveReference({ ...base, references: [], named: 'Bohemian Rhapsody' })).toEqual({ reason: 'nothing called "Bohemian Rhapsody" is attached or in the library' });
  });
});
