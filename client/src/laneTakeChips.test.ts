import { describe, expect, it } from 'vitest';
import type { Layer, Version } from './api';
import type { SingleEditorJob } from './editorJob';
import { auditionLayers, laneTakes } from './laneTakeChips';

const v = (id: string, active = false) => ({ id, active: active ? 1 : 0, audio_file: `${id}.flac` }) as unknown as Version;
/** Versions arrive newest first. */
const layer = (ids: string[], activeId: string, id = 'base'): Layer =>
  ({ id, name: 'Base', kind: 'base', versions: ids.map((x) => v(x, x === activeId)) }) as unknown as Layer;

describe('laneTakes', () => {
  it('v1 … vN oldest first, the active one marked', () => {
    const chips = laneTakes(layer(['c', 'b', 'a'], 'c'), []);
    expect(chips).toEqual([
      { kind: 'take', versionId: 'a', number: 1, active: false },
      { kind: 'take', versionId: 'b', number: 2, active: false },
      { kind: 'take', versionId: 'c', number: 3, active: true },
    ]);
  });

  it('a long history keeps the newest and the active one, the rest counted', () => {
    const ids = ['h', 'g', 'f', 'e', 'd', 'c', 'b', 'a']; // 8 takes, a = v1 active
    const chips = laneTakes(layer(ids, 'a'), [], 4);
    expect(chips[0]).toEqual({ kind: 'more', count: 3 });
    expect(chips.slice(1).map((c) => (c.kind === 'take' ? c.number : 0))).toEqual([1, 5, 6, 7, 8]);
  });

  it("a take still being made on this layer is a dashed chip after the others; another layer's isn't", () => {
    const jobs = [
      { kind: 'repaint', key: 'k1', layerId: 'base', stage: 'running' },
      { kind: 'retake', key: 'k2', layerId: 'base', stage: 'running', queuePosition: 1 },
      { kind: 'repaint', key: 'k3', layerId: 'drums', stage: 'running' },
    ] as unknown as SingleEditorJob[];
    const chips = laneTakes(layer(['b', 'a'], 'b'), jobs);
    expect(chips.slice(2)).toEqual([
      { kind: 'running', key: 'k1', number: 3, queued: false, label: 'repainting' },
      { kind: 'running', key: 'k2', number: 4, queued: true, label: 'making one more like it' },
    ]);
  });
});

describe('auditionLayers', () => {
  it('the auditioned take plays in its layer; nothing else changes', () => {
    const layers = [layer(['b', 'a'], 'b'), layer(['y', 'x'], 'y', 'drums')];
    const out = auditionLayers(layers, { layerId: 'base', versionId: 'a' });
    expect(out[0].versions.find((x) => x.active)?.id).toBe('a');
    expect(out[1]).toBe(layers[1]);
    expect(auditionLayers(layers, null)).toBe(layers);
  });
});
