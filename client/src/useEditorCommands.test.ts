import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Layer, SongDetail } from './api';
import type { Section } from './lyricSections';
import { editorCommands } from './useEditorCommands';
import { useDockRequest } from './dockRequest';
import { TRACK_NAMES } from './trackNames';
import { useEditorJobStore } from './editorJobStore';

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
    setSelection: vi.fn(), setFocusedLayerId: vi.fn(), setVerb: vi.fn(), ...over,
  };
}

const focus = vi.fn();
const query = vi.fn((_selector: string) => ({ focus, scrollIntoView: () => {} }));

beforeEach(() => {
  focus.mockReset();
  query.mockClear();
  vi.useFakeTimers();
  vi.stubGlobal('document', { querySelector: query });
  useDockRequest.setState({ track: null, exportWhat: null });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const run = (v: ReturnType<typeof verbs>, id: string) => {
  editorCommands(v).find((c) => c.id === id)!.run();
  vi.runAllTimers();
};

describe('editorCommands', () => {
  it('lists the dock verbs as DO items with their keys, then the layers under OPEN', () => {
    const items = editorCommands(verbs());
    const labels = items.map((c) => `${c.group} ${c.label}${c.key ? ` [${c.key}]` : ''}`);
    expect(labels.slice(0, 2)).toEqual(['DO Repaint VERSE 2 · VOCALS [R]', 'DO Repaint CHORUS · VOCALS [R]']);
    expect(labels.filter((l) => l.startsWith('DO Add layer'))).toHaveLength(TRACK_NAMES.length);
    expect(labels).toContain('DO Add layer · auto [L]');
    expect(labels).toContain('DO Add layer · strings [L]');
    expect(labels.slice(-7)).toEqual([
      'DO Split BASE [S]',
      'DO Split VOCALS [S]',
      'DO Export mix [E]',
      'DO Export stems [E]',
      'DO Export remastered mix [E]',
      'OPEN Copper Sky › BASE',
      'OPEN Copper Sky › VOCALS',
    ]);
    expect(items.find((c) => c.id === 'repaint:section:0')?.sub).toBe('1:32–2:07');
    expect(items.find((c) => c.id === 'export:mix')?.sub).toBe('Copper Sky.wav · what you hear');
  });

  it('offers Export score as MIDI only for a song YuE2 made, opening EXPORT on it', () => {
    expect(editorCommands(verbs()).some((c) => c.id === 'export:midi')).toBe(false);
    const v = verbs({ song: { ...song, engine: 'yue2' } });
    const item = editorCommands(v).find((c) => c.id === 'export:midi');
    expect(item?.sub).toBe('Copper Sky.mid · the score, not the audio');
    run(v, 'export:midi');
    expect(v.setVerb).toHaveBeenLastCalledWith('export');
    expect(useDockRequest.getState().exportWhat).toBe('midi');
  });

  it('offers the current selection unless it is exactly a named section', () => {
    const custom = editorCommands(verbs({ selection: { start: 10, end: 20 } }));
    expect(custom[0]).toMatchObject({ id: 'repaint:selection', label: 'Repaint 0:10–0:20 · VOCALS', key: 'R' });
    const exact = editorCommands(verbs({ selection: { start: 92, end: 127 } }));
    expect(exact.some((c) => c.id === 'repaint:selection')).toBe(false);
  });

  it('falls back to BASE when no layer is focused', () => {
    expect(editorCommands(verbs({ focusedLayer: undefined }))[0].label).toBe('Repaint VERSE 2 · BASE');
  });

  it('a repaint item selects its section, opens REPAINT and focuses its instruction field', () => {
    const v = verbs();
    run(v, 'repaint:section:1');
    expect(v.setSelection).toHaveBeenCalledWith({ start: 127, end: 150 });
    expect(v.setVerb).toHaveBeenCalledWith('repaint');
    expect(query).toHaveBeenCalledWith('.dock-panel[aria-label="REPAINT"] .dock-prompt');
    expect(focus).toHaveBeenCalled();
  });

  it('an add-layer item opens ADD LAYER with its track picked', () => {
    const v = verbs();
    run(v, 'add-layer:strings');
    expect(v.setVerb).toHaveBeenCalledWith('addLayer');
    expect(useDockRequest.getState().track).toBe('strings');
    expect(query).toHaveBeenCalledWith('.dock-panel[aria-label="ADD LAYER"] .dock-prompt');
    run(v, 'add-layer:auto');
    expect(useDockRequest.getState().track).toBe('');
  });

  it('split focuses its layer on SPLIT; export opens EXPORT on what it names; OPEN focuses a layer', () => {
    const v = verbs();
    run(v, 'split:l1');
    expect(v.setFocusedLayerId).toHaveBeenLastCalledWith('l1');
    expect(v.setVerb).toHaveBeenLastCalledWith('split');
    run(v, 'export:stems');
    expect(v.setVerb).toHaveBeenLastCalledWith('export');
    expect(useDockRequest.getState().exportWhat).toBe('stems');
    run(v, 'layer:l2');
    expect(v.setFocusedLayerId).toHaveBeenLastCalledWith('l2');
  });

  it('never commits: running every item starts no editor job', () => {
    const v = verbs({ selection: { start: 10, end: 20 } });
    for (const c of editorCommands(v)) c.run();
    vi.runAllTimers();
    expect(useEditorJobStore.getState().editorJobs).toEqual([]);
    expect(useEditorJobStore.getState().splitJob).toBeNull();
  });
});
