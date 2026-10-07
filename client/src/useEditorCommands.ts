import { useEffect, type Dispatch, type SetStateAction } from 'react';
import type { Layer, SongDetail } from './api';
import type { Region } from './Waveform';
import type { Section } from './lyricSections';
import type { DockVerb } from './dockTarget';
import { fmtRange } from './dockTarget';
import { useDockRequest, type ExportWhat } from './dockRequest';
import { TRACK_NAMES } from './trackNames';
import { useCommandStore, type Command } from './commandStore';

/** What the palette's DO and layer items reach in the Editor. */
interface EditorVerbs {
  song: SongDetail | null;
  focusedLayer: Layer | undefined;
  sections: Section[];
  selection: Region | null;
  setSelection: (region: Region | null) => void;
  setFocusedLayerId: Dispatch<SetStateAction<string | null>>;
  setVerb: (verb: DockVerb) => void;
}

const REPAINT_PROMPT = '.dock-panel[aria-label="REPAINT"] .dock-prompt';
const ADD_LAYER_PROMPT = '.dock-panel[aria-label="ADD LAYER"] .dock-prompt';

/** Focuses a dock field once the verb switch has rendered (a hidden panel can't take focus). */
function focusSoon(selector: string): void {
  setTimeout(() => {
    const el = document.querySelector<HTMLInputElement>(selector);
    el?.scrollIntoView({ block: 'nearest' });
    el?.focus();
  }, 0);
}

const EXPORTS: { what: ExportWhat; label: string; sub: (title: string) => string }[] = [
  { what: 'mix', label: 'Export mix', sub: (title) => `${title}.wav · what you hear` },
  { what: 'stems', label: 'Export stems', sub: () => "each layer's active take" },
  { what: 'remaster', label: 'Export remastered mix', sub: () => 'one ACE-Step pass over the mix' },
  { what: 'midi', label: 'Export score as MIDI', sub: (title) => `${title}.mid · the score, not the audio` },
];

/** Pure, for the hook below: the open song's DO items and its layers under OPEN. Every item
 * opens a dock verb with its target and fields set (keys shown as R/L/S/E); the commit stays
 * the dock's, under its consequence line. */
export function editorCommands(v: EditorVerbs & { song: SongDetail }): Command[] {
  const name = (v.focusedLayer?.name ?? 'base').toUpperCase();
  const repaint = (region: Region) => () => { v.setSelection(region); v.setVerb('repaint'); focusSoon(REPAINT_PROMPT); };
  const named = v.sections.filter((s) => s.label.trim());
  const exact = (s: Section) => v.selection?.start === s.start && v.selection?.end === s.end;
  const items: Command[] = [];
  if (v.selection && !named.some(exact)) {
    items.push({
      id: 'repaint:selection', group: 'DO', label: `Repaint ${fmtRange(v.selection)} · ${name}`,
      sub: 'the current selection', key: 'R', run: repaint(v.selection),
    });
  }
  named.forEach((s, i) => items.push({
    id: `repaint:section:${i}`, group: 'DO', label: `Repaint ${s.label.toUpperCase()} · ${name}`,
    sub: fmtRange(s), key: 'R', run: repaint({ start: s.start, end: s.end }),
  }));
  for (const t of TRACK_NAMES) {
    items.push({
      id: `add-layer:${t.value || 'auto'}`, group: 'DO', label: `Add layer · ${t.label.toLowerCase()}`,
      sub: t.value ? `a new ${t.label.toLowerCase()} lane, conditioned on the mix` : 'named from its description',
      key: 'L',
      run: () => { v.setVerb('addLayer'); useDockRequest.getState().pickTrack(t.value); focusSoon(ADD_LAYER_PROMPT); },
    });
  }
  for (const l of v.song.layers) {
    items.push({
      id: `split:${l.id}`, group: 'DO', label: `Split ${l.name.toUpperCase()}`, sub: 'vocals, drums, bass and other as new stems',
      key: 'S', run: () => { v.setFocusedLayerId(l.id); v.setVerb('split'); },
    });
  }
  for (const e of EXPORTS) {
    if (e.what === 'midi' && v.song.engine !== 'yue2') continue; // only YuE2 leaves a score
    items.push({
      id: `export:${e.what}`, group: 'DO', label: e.label, sub: e.sub(v.song.title), key: 'E',
      run: () => { v.setVerb('export'); useDockRequest.getState().pickExport(e.what); },
    });
  }
  for (const l of v.song.layers) {
    items.push({
      id: `layer:${l.id}`, group: 'OPEN', label: `${v.song.title} › ${l.name.toUpperCase()}`,
      sub: `layer · v${l.versions.length}`, run: () => v.setFocusedLayerId(l.id),
    });
  }
  return items;
}

/** Publishes the Editor's items while it is mounted and scopes the palette to its song. */
export function useEditorCommands(v: EditorVerbs): void {
  const publish = useCommandStore((s) => s.publish);
  const clear = useCommandStore((s) => s.clear);
  const { song, focusedLayer, sections, selection, setSelection, setFocusedLayerId, setVerb } = v;

  useEffect(() => {
    if (!song) return;
    const items = editorCommands({ song, focusedLayer, sections, selection, setSelection, setFocusedLayerId, setVerb });
    publish('editor', items, song.title);
  }, [publish, song, focusedLayer, sections, selection, setSelection, setFocusedLayerId, setVerb]);

  useEffect(() => () => clear('editor'), [clear]);
}
