/** The split tray under a lane (PLAN.md "Editor Redesign", PR 9): nothing without an open split, CLOSE names what it
 * discards, plain claim verbs. */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Layer, StemResult } from './api';
import { SplitTrayView } from './SplitTray';

const layer = { id: 'base', name: 'Base', kind: 'base', versions: [{ id: 'v1', active: 1 }] } as unknown as Layer;
const STEMS: StemResult[] = [
  { kind: 'vocals', status: 'done' }, // no file: AudioPreview can't render on the server
  { kind: 'drums', status: 'done', audioFile: 'd.flac', claimed: 'added' },
  { kind: 'bass', status: 'done' },
  { kind: 'other', status: 'failed', error: 'boom' },
];
const noop = async () => {};
const session = (stems: StemResult[] | null) => ({
  stems, status: null, error: '', failed: null, ahead: 0, busyKind: null, busyAll: false,
  claim: noop, reextract: noop, splitAgain: noop, close: noop,
});
const html = (stems: StemResult[] | null) => renderToStaticMarkup(<SplitTrayView layer={layer} session={session(stems)} scoreOpen={false} />);

describe('SplitTrayView', () => {
  it('nothing when the layer has no open split', () => {
    expect(html(null)).toBe('');
  });

  it('names the layer, and CLOSE says how many unkept stems it discards', () => {
    const out = html(STEMS);
    expect(out).toContain('STEMS OF BASE');
    expect(out).toContain('CLOSE · DISCARD 3 UNKEPT');
  });

  it('claims read KEEP AS LAYER and USE AS <LAYER> TAKE; a kept stem says so', () => {
    const out = html(STEMS);
    expect(out).toContain('KEEP AS LAYER');
    expect(out).toContain('USE AS BASE TAKE');
    expect(out).toContain('kept as a layer');
  });
});
