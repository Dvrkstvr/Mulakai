import { describe, it, expect } from 'vitest';
import type { EngineCapabilities, EngineInfo } from './api';
import { aceOnlyNote, durationReadout, pickerEngines, songDetailNotes, unavailableReason, unsupported } from './engineCaps';

const BASE: EngineCapabilities = {
  duration: 'exact', musicalMeta: 'params', referenceAudio: true, adapters: true, seed: true, languages: 'any',
  sectionTags: null, lmTools: true, advanced: true, takes: true, extraControls: [], consequence: '',
};
// The two real descriptors (server/src/services/engines/yue2.ts, heartmula.ts), trimmed.
const YUE2: EngineCapabilities = {
  ...BASE, duration: 'none', musicalMeta: 'style-text', referenceAudio: false, adapters: false,
  languages: ['en', 'zh'], lmTools: false, advanced: false, takes: false, extraControls: ['cfg', 'cot'],
};
const HEARTMULA: EngineCapabilities = {
  ...YUE2, duration: 'max', musicalMeta: 'none', seed: false, languages: ['zh', 'en'],
  extraControls: ['cfg', 'temperature', 'topK'],
};

const info = (id: EngineInfo['id'], capabilities: EngineCapabilities, configured = true, ready = true): EngineInfo =>
  ({ id, label: id.toUpperCase(), capabilities, configured, ready });

describe('unsupported', () => {
  it('gates nothing on ACE-Step', () => {
    for (const f of ['duration', 'bpm', 'keyScale', 'timeSignature', 'vocalLanguage', 'takes'] as const) {
      expect(unsupported(f, null)).toBe(false);
      expect(unsupported(f, BASE)).toBe(false);
    }
  });

  it('keeps YuE2\'s style-text details live, and gates duration, language and takes', () => {
    expect(['bpm', 'keyScale', 'timeSignature'].map((f) => unsupported(f as never, YUE2))).toEqual([false, false, false]);
    expect(unsupported('duration', YUE2)).toBe(true);
    expect(unsupported('vocalLanguage', YUE2)).toBe(true);
    expect(unsupported('takes', YUE2)).toBe(true);
  });

  it('keeps HeartMuLa\'s max duration live, and gates its missing musical metadata', () => {
    expect(unsupported('duration', HEARTMULA)).toBe(false);
    expect(['bpm', 'keyScale', 'timeSignature'].map((f) => unsupported(f as never, HEARTMULA))).toEqual([true, true, true]);
  });
});

describe('durationReadout', () => {
  it.each([
    [0, null, 'AUTO'], [120, null, '120s'], [120, YUE2, 'N/A'], [0, YUE2, 'N/A'],
    [120, HEARTMULA, 'MAX 120s'], [0, HEARTMULA, 'AUTO'],
  ] as const)('%ss on %s', (seconds, caps, readout) => {
    expect(durationReadout(seconds, caps)).toBe(readout);
  });
});

describe('notes', () => {
  it('explains every gated or reinterpreted control, once each', () => {
    expect(songDetailNotes(null)).toEqual([]);
    const notes = songDetailNotes(info('yue2', YUE2));
    expect(notes).toEqual([
      'DURATION — YUE2 sets the length from the song it plans',
      'BPM, KEY / SCALE, TIME SIGNATURE — sent to YUE2 as style text, a hint rather than a guarantee',
      'VOCAL LANGUAGE — YUE2 sings en, zh, following the lyrics',
      'TAKES — YUE2 makes one take per generation',
    ]);
    expect(songDetailNotes(info('heartmula', HEARTMULA))[0]).toMatch(/a cap for HEARTMULA, not a target/);
    expect(songDetailNotes(info('heartmula', HEARTMULA))[1]).toMatch(/HEARTMULA takes none of them/);
  });

  it('names the ACE-Step settings an engine swaps out', () => {
    expect(aceOnlyNote(info('yue2', YUE2))).toBe(
      'LM MODEL, THINKING, AI ENHANCE, DIT MODEL, STEPS, GUIDANCE, ADVANCED, REFERENCE AUDIO are ACE-Step settings — they don\'t apply to YUE2',
    );
  });
});

describe('picker', () => {
  const acestep = info('acestep', BASE);

  it('hides the ENGINE row until some extra engine is configured', () => {
    expect(pickerEngines([acestep])).toEqual([]);
    expect(pickerEngines([acestep, info('yue2', YUE2, false, false)])).toEqual([]);
  });

  it('lists ACE-Step first, then configured engines only, reachable or not', () => {
    const yue = info('yue2', YUE2, true, false);
    const heart = info('heartmula', HEARTMULA, false, false);
    expect(pickerEngines([yue, heart, acestep]).map((e) => e.id)).toEqual(['acestep', 'yue2']);
  });

  it('says why an engine can\'t be picked', () => {
    expect(unavailableReason({ configured: true, ready: true })).toBe('');
    expect(unavailableReason({ configured: true, ready: false })).toMatch(/not reachable/);
    expect(unavailableReason({ configured: false, ready: false })).toMatch(/not configured/);
  });
});
