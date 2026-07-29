import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Voice } from './api';

const listVoices = vi.fn();
vi.mock('./api', () => ({ api: { listVoices: () => listVoices() } }));

const { useVoiceStore } = await import('./voiceStore');

const voice = (over: Partial<Voice> = {}): Voice => ({
  id: 'v1',
  name: 'Daniel',
  audio_file: 'daniel.wav',
  duration: 77,
  tags: '',
  default_audio_influence: 0.5,
  default_style_influence: 0.5,
  created_at: '2026-07-30T00:00:00Z',
  ...over,
});

const reset = () => useVoiceStore.setState({
  voices: [], selectedVoiceId: null, uploadedRefFile: null,
  audioInfluence: 0.5, styleInfluence: 0.5, missingReferenceLabel: null,
});

describe('restoreReference', () => {
  beforeEach(() => {
    reset();
    listVoices.mockReset();
    listVoices.mockResolvedValue([voice()]);
  });

  it('matches the song\'s label by name and applies the influences it was rendered at', async () => {
    await useVoiceStore.getState().restoreReference('Daniel', 0.8, 0.3);

    const s = useVoiceStore.getState();
    expect(s.selectedVoiceId).toBe('v1');
    // The song's own values, not the voice's 0.5/0.5 defaults that selectVoice() applies first.
    expect(s.audioInfluence).toBe(0.8);
    expect(s.styleInfluence).toBe(0.3);
    expect(s.missingReferenceLabel).toBeNull();
  });

  it('keeps the voice defaults when the origin never persisted influences (cover/complete)', async () => {
    listVoices.mockResolvedValue([voice({ default_audio_influence: 0.7, default_style_influence: 0.2 })]);

    await useVoiceStore.getState().restoreReference('Daniel', undefined, undefined);

    const s = useVoiceStore.getState();
    expect(s.selectedVoiceId).toBe('v1');
    expect(s.audioInfluence).toBe(0.7);
    expect(s.styleInfluence).toBe(0.2);
  });

  it('fetches the voice list when it has not been loaded yet', async () => {
    await useVoiceStore.getState().restoreReference('Daniel', 0.8, 0.3);
    expect(listVoices).toHaveBeenCalledTimes(1);
    expect(useVoiceStore.getState().selectedVoiceId).toBe('v1');
  });

  it('flags a label that resolves to nothing instead of generating unconditioned', async () => {
    listVoices.mockResolvedValue([voice({ name: 'Someone Else' })]);

    await useVoiceStore.getState().restoreReference('my-clip.wav', 0.8, 0.3);

    const s = useVoiceStore.getState();
    expect(s.missingReferenceLabel).toBe('my-clip.wav');
    expect(s.selectedVoiceId).toBeNull();
    // No silent fallback: the influences of a reference we don't have would be misleading.
    expect(s.audioInfluence).toBe(0.5);
  });

  it('clears a stale warning when a draft carries no reference at all', async () => {
    useVoiceStore.setState({ missingReferenceLabel: 'gone.wav' });

    await useVoiceStore.getState().restoreReference(undefined, undefined, undefined);

    expect(useVoiceStore.getState().missingReferenceLabel).toBeNull();
    expect(listVoices).not.toHaveBeenCalled();
  });

  it('survives an unreachable voice list by warning rather than throwing', async () => {
    listVoices.mockRejectedValue(new Error('offline'));

    await expect(useVoiceStore.getState().restoreReference('Daniel', 0.8, 0.3)).resolves.toBeUndefined();
    expect(useVoiceStore.getState().missingReferenceLabel).toBe('Daniel');
  });
});

describe('picking a reference clears the warning', () => {
  beforeEach(() => {
    reset();
    useVoiceStore.setState({ voices: [voice()], missingReferenceLabel: 'gone.wav' });
  });

  it('on selectVoice', () => {
    useVoiceStore.getState().selectVoice('v1');
    expect(useVoiceStore.getState().missingReferenceLabel).toBeNull();
  });

  it('on setUploadedRefFile', () => {
    useVoiceStore.getState().setUploadedRefFile(new File(['x'], 'clip.wav'));
    expect(useVoiceStore.getState().missingReferenceLabel).toBeNull();
  });

  it('even when the user explicitly picks NONE', () => {
    useVoiceStore.getState().selectVoice(null);
    expect(useVoiceStore.getState().missingReferenceLabel).toBeNull();
  });
});
