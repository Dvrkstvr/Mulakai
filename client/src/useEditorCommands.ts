import { useEffect, type Dispatch, type SetStateAction } from 'react';
import type { Layer, SongDetail } from './api';
import type { Region } from './Waveform';
import type { Section } from './lyricSections';
import type { RailMode } from './EditorRail';
import { useCommandStore, type Command } from './commandStore';

/** What the palette's DO and layer items reach in the Editor. */
interface EditorVerbs {
  song: SongDetail | null;
  focusedLayer: Layer | undefined;
  sections: Section[];
  selection: Region | null;
  setSelection: (region: Region | null) => void;
  setFocusedLayerId: Dispatch<SetStateAction<string | null>>;
  setRailMode: Dispatch<SetStateAction<RailMode>>;
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/** Today's entry points are the repaint prompt and the ADD LAYER row's prompt; whichever of
 * S1/S3 lands second rewires these to the Action Dock's verbs (PLAN.md "UI Redesign", S3.3). */
const REPAINT_PROMPT = '.repaint input[placeholder^="Describe what should change"]';
const ADD_LAYER_PROMPT = '.layer-add-row input[placeholder^="Describe what to add"]';

function focusField(selector: string): void {
  const el = document.querySelector<HTMLInputElement>(selector);
  el?.scrollIntoView({ block: 'nearest' });
  el?.focus();
}

/** Pure, for the hook below: the open song's DO items and its layers under OPEN. Every item only
 * targets and focuses; the commit stays REPAINT REGION / GENERATE under its consequence line. */
export function editorCommands(v: EditorVerbs & { song: SongDetail }): Command[] {
  const layer = v.focusedLayer;
  const name = (layer?.name ?? 'base').toUpperCase();
  const repaint = (region: Region) => () => { v.setSelection(region); focusField(REPAINT_PROMPT); };
  const named = v.sections.filter((s) => s.label.trim());
  const exact = (s: Section) => v.selection?.start === s.start && v.selection?.end === s.end;
  const items: Command[] = [];
  if (v.selection && !named.some(exact)) {
    items.push({
      id: 'repaint:selection', group: 'DO', label: `Repaint ${fmt(v.selection.start)}–${fmt(v.selection.end)} · ${name}`,
      sub: 'the current selection', run: repaint(v.selection),
    });
  }
  named.forEach((s, i) => items.push({
    id: `repaint:section:${i}`, group: 'DO', label: `Repaint ${s.label.toUpperCase()} · ${name}`,
    sub: `${fmt(s.start)}–${fmt(s.end)}`, run: repaint({ start: s.start, end: s.end }),
  }));
  items.push({
    id: 'add-layer', group: 'DO', label: 'Add a layer', sub: `to ${v.song.title}`,
    run: () => focusField(ADD_LAYER_PROMPT),
  });
  for (const l of v.song.layers) {
    items.push({
      id: `split:${l.id}`, group: 'DO', label: `Split ${l.name.toUpperCase()} into stems`, sub: 'vocals, drums, bass, other',
      run: () => { v.setFocusedLayerId(l.id); v.setRailMode('split'); },
    });
  }
  items.push({
    id: 'export', group: 'DO', label: 'Export stems or a remastered mix', sub: v.song.title,
    run: () => v.setRailMode('export'),
  });
  for (const l of v.song.layers) {
    items.push({
      id: `layer:${l.id}`, group: 'OPEN', label: `${v.song.title} › ${l.name.toUpperCase()}`,
      sub: `layer · v${l.versions.length}`,
      run: () => { v.setFocusedLayerId(l.id); v.setRailMode('history'); },
    });
  }
  return items;
}

/** Publishes the Editor's items while it is mounted and scopes the palette to its song. */
export function useEditorCommands(v: EditorVerbs): void {
  const publish = useCommandStore((s) => s.publish);
  const clear = useCommandStore((s) => s.clear);
  const { song, focusedLayer, sections, selection, setSelection, setFocusedLayerId, setRailMode } = v;

  useEffect(() => {
    if (!song) return;
    const items = editorCommands({ song, focusedLayer, sections, selection, setSelection, setFocusedLayerId, setRailMode });
    publish('editor', items, song.title);
  }, [publish, song, focusedLayer, sections, selection, setSelection, setFocusedLayerId, setRailMode]);

  useEffect(() => () => clear('editor'), [clear]);
}
