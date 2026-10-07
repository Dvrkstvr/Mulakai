import { describe, it, expect, vi } from 'vitest';
import type { Folder, Song } from './api';
import type { Command } from './commandStore';
import { appCommands, paletteResults, visibleCommands, MAX_PER_GROUP, type AppCommandDeps } from './commandIndex';

const song = (id: string, title: string) => ({ id, title }) as Song;
const folder = (id: string, name: string, n: number) => ({ id, name, song_count: n }) as Folder;

function deps(over: Partial<AppCommandDeps> = {}): AppCommandDeps {
  return {
    songs: [song('s1', 'Copper Sky'), song('s2', 'Night Drive')],
    folders: [folder('f1', 'Demos', 1)],
    settingsSections: [{ id: 'voices', label: 'Voices', sub: 'upload, rename, delete reference vocals' }],
    openSong: vi.fn(), openFolder: vi.fn(), startCreate: vi.fn(), remake: vi.fn(), openSettings: vi.fn(), convertAbcFile: vi.fn(),
    ...over,
  };
}

const cmd = (id: string, group: Command['group'], label: string, sub?: string): Command => ({ id, group, label, sub, run: () => {} });

describe('appCommands', () => {
  it('indexes songs and folders under OPEN, start points and remakes under CREATE, sections under SETTINGS', () => {
    const items = appCommands(deps());
    const by = (g: string) => items.filter((c) => c.group === g).map((c) => c.label);
    expect(by('DO')).toEqual(['Convert an .abc file to MIDI']);
    expect(by('OPEN')).toEqual(['Copper Sky', 'Night Drive', 'Demos']);
    expect(by('CREATE')).toEqual([
      'Start from an idea', 'Start from a song I have', 'Start from one track', 'Remake Copper Sky', 'Remake Night Drive',
    ]);
    expect(by('SETTINGS')).toEqual(['Voices']);
    expect(items.find((c) => c.id === 'folder:f1')?.sub).toBe('folder · 1 song');
  });

  it('runs each item through its navigation callback', () => {
    const d = deps();
    const items = appCommands(d);
    const run = (id: string) => items.find((c) => c.id === id)!.run();
    run('song:s2');
    run('folder:f1');
    run('create:audio');
    run('remake:s1');
    run('settings:voices');
    run('midi:abc-file');
    expect(d.openSong).toHaveBeenCalledWith('s2');
    expect(d.openFolder).toHaveBeenCalledWith('f1');
    expect(d.startCreate).toHaveBeenCalledWith('audio');
    expect(d.remake).toHaveBeenCalledWith(d.songs[0]);
    expect(d.openSettings).toHaveBeenCalledWith('voices');
    expect(d.convertAbcFile).toHaveBeenCalledOnce();
  });
});

describe('visibleCommands', () => {
  const sources = {
    app: [cmd('song:s1', 'OPEN', 'Copper Sky')],
    editor: [cmd('repaint', 'DO', 'Repaint VERSE 2 · vocals'), cmd('layer:l1', 'OPEN', 'Copper Sky › VOCALS')],
  };

  it("narrows to the scoping view's own items while scoped", () => {
    expect(visibleCommands(sources, { source: 'editor' }, true).map((c) => c.id)).toEqual(['repaint', 'layer:l1']);
  });

  it('lists everything in ALL, or when nothing scopes the palette', () => {
    expect(visibleCommands(sources, { source: 'editor' }, false)).toHaveLength(3);
    expect(visibleCommands(sources, null, true)).toHaveLength(3);
  });
});

describe('paletteResults', () => {
  const items = [
    cmd('s', 'SETTINGS', 'Voices', 'upload, rename, delete reference vocals'),
    cmd('o1', 'OPEN', 'Night Drive', 'song'),
    cmd('d1', 'DO', 'Add a layer', 'to Copper Sky'),
    cmd('d2', 'DO', 'Split VOCALS', 'into stems'),
  ];

  it('groups in DO, OPEN, CREATE, SETTINGS order and drops empty groups', () => {
    expect(paletteResults(items, '').map((g) => g.group)).toEqual(['DO', 'OPEN', 'SETTINGS']);
  });

  it('keeps published order on an empty query', () => {
    expect(paletteResults(items, '')[0].items.map((c) => c.id)).toEqual(['d1', 'd2']);
  });

  it('filters by the matcher and ranks label matches first', () => {
    const groups = paletteResults(items, 'vocals');
    expect(groups.map((g) => g.group)).toEqual(['DO', 'SETTINGS']);
    expect(groups[0].items.map((c) => c.id)).toEqual(['d2']);
  });

  it('matches the sub line only as a substring', () => {
    expect(paletteResults(items, 'copper').flatMap((g) => g.items.map((c) => c.id))).toEqual(['d1']);
    // "upload, rename, delete reference vocals" holds u…r…v as a subsequence, not as text.
    expect(paletteResults(items, 'urv').flatMap((g) => g.items.map((c) => c.id))).toEqual([]);
  });

  it('ranks a label match above a sub-line match', () => {
    const both = [cmd('sub', 'OPEN', 'Night Drive', 'stems of Copper Sky'), cmd('label', 'OPEN', 'Copper Sky')];
    expect(paletteResults(both, 'copper')[0].items.map((c) => c.id)).toEqual(['label', 'sub']);
  });

  it('caps each group', () => {
    const many = Array.from({ length: MAX_PER_GROUP + 4 }, (_, i) => cmd(`o${i}`, 'OPEN', `Song ${i}`));
    expect(paletteResults(many, '')[0].items).toHaveLength(MAX_PER_GROUP);
  });
});
