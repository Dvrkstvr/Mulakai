import { describe, expect, it } from 'vitest';
import { rowClickOpensDetail, songRowState } from './songRowState';

describe('songRowState', () => {
  it('marks the row the footer is playing', () => {
    expect(songRowState('a', null, 'a', true)).toEqual({ live: true, className: 'row playing' });
  });

  it('drops the mark when that song is paused', () => {
    expect(songRowState('a', null, 'a', false)).toEqual({ live: false, className: 'row' });
  });

  it('leaves other rows alone while a song plays', () => {
    expect(songRowState('b', null, 'a', true)).toEqual({ live: false, className: 'row' });
  });

  it('keeps selected and playing independent', () => {
    expect(songRowState('a', 'a', 'a', true).className).toBe('row selected playing');
    expect(songRowState('a', 'a', undefined, false).className).toBe('row selected');
  });
});

describe('rowClickOpensDetail', () => {
  const at = (inControl: boolean) => ({ closest: () => (inControl ? {} : null) });

  it('a click anywhere on the card opens the detail rail', () => {
    expect(rowClickOpensDetail(at(false))).toBe(true);
  });

  it("a click on one of the row's buttons keeps that button's action", () => {
    expect(rowClickOpensDetail(at(true))).toBe(false);
  });
});
