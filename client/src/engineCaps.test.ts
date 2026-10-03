import { describe, it, expect } from 'vitest';
import type { EngineCapabilities, EngineInfo } from './api';
import {
  aceOnlyNote, coverEngines, coverUnavailableReason, durationReadout, languageOptions, liveLanguage, pickerEngines,
  songDetailNotes, unavailableReason, unsupported,
} from './engineCaps';

const BASE: EngineCapabilities = {
  duration: 'exact', musicalMeta: 'params', referenceAudio: true, adapters: true, seed: true, languages: 'any',
  sectionTags: null, lmTools: true, advanced: true, takes: true, instrumental: true, extraControls: [], consequence: '',
};
// The two real descriptors (server/src/services/engines/yue2.ts, heartmula.ts), trimmed.
const YUE2: EngineCapabilities = {
  ...BASE, duration: 'none', musicalMeta: 'style-text', referenceAudio: false, adapters: false,
  languages: ['en', 'zh'], lmTools: false, advanced: false, takes: false, extraControls: ['cfg', 'cot'],
};
const HEARTMULA: EngineCapabilities = {
  ...YUE2, duration: 'max', musicalMeta: 'none', seed: false, languages: ['zh', 'en'], instrumental: false,
  extraControls: ['cfg', 'temperature', 'topK'],
};

const info = (
  id: EngineInfo['id'], capabilities: EngineCapabilities, configured = true, ready = true, coverReady = false,
): EngineInfo => ({ id, label: id.toUpperCase(), capabilities, configured, ready, coverReady });

describe('unsupported', () => {
  it('gates nothing on ACE-Step', () => {
    for (const f of ['duration', 'bpm', 'keyScale', 'timeSignature', 'vocalLanguage', 'takes', 'instrumental'] as const) {
      expect(unsupported(f, null)).toBe(false);
      expect(unsupported(f, BASE)).toBe(false);
    }
  });

  it('keeps INSTRUMENTAL live on YuE2 and N/A on HeartMuLa, which has no instrumental mode', () => {
    expect(unsupported('instrumental', YUE2)).toBe(false);
    expect(unsupported('instrumental', HEARTMULA)).toBe(true);
  });

  it('keeps YuE2\'s style-text details and language live, and gates duration and takes', () => {
    expect(['bpm', 'keyScale', 'timeSignature', 'vocalLanguage'].map((f) => unsupported(f as never, YUE2)))
      .toEqual([false, false, false, false]);
    expect(unsupported('duration', YUE2)).toBe(true);
    expect(unsupported('takes', YUE2)).toBe(true);
  });

  it('keeps HeartMuLa\'s max duration live, and gates its missing musical metadata and language', () => {
    expect(unsupported('duration', HEARTMULA)).toBe(false);
    expect(['bpm', 'keyScale', 'timeSignature', 'vocalLanguage'].map((f) => unsupported(f as never, HEARTMULA)))
      .toEqual([true, true, true, true]);
  });
});

describe('VOCAL LANGUAGE', () => {
  it('offers AUTO plus only the languages a listing engine sings', () => {
    expect(languageOptions(YUE2).map((o) => o.label)).toEqual(['AUTO', 'English', 'Chinese']);
    expect(languageOptions(null).length).toBeGreaterThan(3);
    expect(languageOptions(BASE)).toEqual(languageOptions(null));
  });

  it('treats a language the engine does not sing, or cannot take, as AUTO', () => {
    expect(liveLanguage('zh', YUE2)).toBe('zh');
    expect(liveLanguage('de', YUE2)).toBe('');
    expect(liveLanguage('de', null)).toBe('de');
    expect(liveLanguage('zh', HEARTMULA)).toBe('');
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
      'BPM, KEY / SCALE, TIME SIGNATURE, VOCAL LANGUAGE — sent to YUE2 as style text, a hint rather than a guarantee',
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

describe('COVER engines', () => {
  it('offers ACE-Step plus the engines that can cover now, and nothing until one can', () => {
    const ace = info('acestep', BASE);
    expect(coverEngines([ace, info('yue2', YUE2), info('heartmula', HEARTMULA)])).toEqual([]);
    const yue = info('yue2', YUE2, true, true, true);
    expect(coverEngines([ace, yue, info('heartmula', HEARTMULA)]).map((e) => e.id)).toEqual(['acestep', 'yue2']);
  });

  it("says why an engine can't cover", () => {
    expect(coverUnavailableReason(info('yue2', YUE2, true, true, true))).toBe('');
    expect(coverUnavailableReason(info('yue2', YUE2, true, true, false))).toMatch(/covers are not set up/);
    expect(coverUnavailableReason(info('yue2', YUE2, false, false, false))).toBe('not configured on the server');
  });
});
