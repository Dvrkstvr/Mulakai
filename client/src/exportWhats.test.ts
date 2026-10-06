import { describe, it, expect } from 'vitest';
import { exportWhats } from './exportWhats';

describe('exportWhats', () => {
  it('adds SCORE AS MIDI only for a song YuE2 made', () => {
    expect(exportWhats({ engine: null }).map((w) => w.id)).toEqual(['mix', 'stems', 'remaster']);
    expect(exportWhats({ engine: 'yue2' }).map((w) => w.id)).toEqual(['mix', 'stems', 'remaster', 'midi']);
  });
});
