import { describe, expect, it } from 'vitest';
import { REFINEMENTS, assistStatusLine } from './assistCopy';

describe('assistStatusLine', () => {
  it('a waiting help says when it starts, never a time', () => {
    expect(assistStatusLine({ kind: 'waiting', position: 2 })).toBe('waiting for the GPU · starts after 2 jobs');
    expect(assistStatusLine({ kind: 'waiting', position: null })).toBe('asking…');
  });

  it('writing, done and failed', () => {
    expect(assistStatusLine({ kind: 'thinking', seconds: 7 })).toBe('writing suggestions… 7 s');
    expect(assistStatusLine({ kind: 'done', count: 3 })).toBe('3 suggestions · USE puts one in the field');
    expect(assistStatusLine({ kind: 'failed', error: 'planner offline' })).toBe('planner offline');
  });
});

describe('REFINEMENTS', () => {
  it('lyrics can keep the melody while changing the image, and translate', () => {
    expect(REFINEMENTS.lyrics).toContain('same syllables, new image');
    expect(REFINEMENTS.lyrics).toContain('translate to German');
  });
});
