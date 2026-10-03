import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Layer, SongDetail } from './api';
import type { Section } from './lyricSections';
import { editorCommands } from './useEditorCommands';

const layer = (id: string, name: string, versions = 1) =>
  ({ id, name, versions: Array.from({ length: versions }, () => ({})) }) as unknown as Layer;

const base = layer('l1', 'Base', 3);
const vocals = layer('l2', 'Vocals', 5);
const song = { id: 's1', title: 'Copper Sky', layers: [base, vocals] } as unknown as SongDetail;
const sections: Section[] = [
  { label: '', start: 0, end: 4 },
  { label: 'Verse 2', start: 92, end: 127 },
  { label: 'Chorus', start: 127, end: 150 },
];

function verbs(over: Partial<Parameters<typeof editorCommands>[0]> = {}) {
  return {
    song, focusedLayer: vocals, sections, selection: null,
    setSelection: vi.fn(), setFocusedLayerId: vi.fn(), setRailMode: vi.fn(), ...over,
  };
}

const focus = vi.fn();

beforeEach(() => {
  focus.mockReset();
  vi.stubGlobal('document', { querySelector: () => ({ focus, scrollIntoView: () => {} }) });
});

afterEach(() => vi.unstubAllGlobals());

describe('editorCommands', () => {
  it('lists DO verbs on the focused layer, then the layers under OPEN', () => {
    const items = editorCommands(verbs());
    expect(items.map((c) => `${c.group} ${c.label}`)).toEqual([
      'DO Repaint VERSE 2 · VOCALS',
      'DO Repaint CHORUS · VOCALS',
      'DO Add a layer',
      'DO Split BASE into stems',
      'DO Split VOCALS into stems',
      'DO Export stems or a remastered mix',
      'OPEN Copper Sky › BASE',
      'OPEN Copper Sky › VOCALS',
    ]);
    expect(items.find((c) => c.id === 'repaint:section:0')?.sub).toBe('1:32–2:07');
    expect(items.find((c) => c.id === 'layer:l2')?.sub).toBe('layer · v5');
  });

  it('offers the current selection unless it is exactly a named section', () => {
    const custom = editorCommands(verbs({ selection: { start: 10, end: 20 } }));
    expect(custom[0]).toMatchObject({ id: 'repaint:selection', label: 'Repaint 0:10–0:20 · VOCALS' });
    const exact = editorCommands(verbs({ selection: { start: 92, end: 127 } }));
    expect(exact.some((c) => c.id === 'repaint:selection')).toBe(false);
  });

  it('falls back to BASE when no layer is focused', () => {
    expect(editorCommands(verbs({ focusedLayer: undefined }))[0].label).toBe('Repaint VERSE 2 · BASE');
  });

  it('targets without committing: a repaint item selects its section and focuses the prompt', () => {
    const v = verbs();
    editorCommands(v).find((c) => c.id === 'repaint:section:1')!.run();
    expect(v.setSelection).toHaveBeenCalledWith({ start: 127, end: 150 });
    expect(focus).toHaveBeenCalled();
  });

  it('opens the split rail on that layer, the export rail, and a layer under OPEN', () => {
    const v = verbs();
    const run = (id: string) => editorCommands(v).find((c) => c.id === id)!.run();
    run('split:l1');
    expect(v.setFocusedLayerId).toHaveBeenLastCalledWith('l1');
    expect(v.setRailMode).toHaveBeenLastCalledWith('split');
    run('export');
    expect(v.setRailMode).toHaveBeenLastCalledWith('export');
    run('layer:l2');
    expect(v.setFocusedLayerId).toHaveBeenLastCalledWith('l2');
    expect(v.setRailMode).toHaveBeenLastCalledWith('history');
  });
});
