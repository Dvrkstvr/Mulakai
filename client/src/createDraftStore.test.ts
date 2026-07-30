import { describe, it, expect, beforeEach } from 'vitest';
import { useCreateDraftStore } from './createDraftStore';

const INITIAL = useCreateDraftStore.getState();
const get = () => useCreateDraftStore.getState();

beforeEach(() => useCreateDraftStore.setState(INITIAL, true));

describe('one draft, three renderings', () => {
  it('keeps the song intent across a tab switch', () => {
    get().patch({ prompt: 'a techno track', lyrics: '[verse]', bpm: 128, keyScale: 'A minor', duration: 120 });
    get().patch({ genType: 'audio' });

    expect(get()).toMatchObject({
      genType: 'audio', prompt: 'a techno track', lyrics: '[verse]', bpm: 128, keyScale: 'A minor', duration: 120,
    });
  });

  it('keeps each tab\'s own source/model choices across a tab switch', () => {
    const file = new File(['x'], 'source.wav');
    get().patchAudio({ source: 'library', selectedSongId: 's1', model: 'xl-sft', variance: 0.9 });
    get().patchArrange({ uploadFile: file, model: 'xl-base' });

    get().patch({ genType: 'prompt' });
    get().patch({ genType: 'audio' });

    expect(get().audio).toMatchObject({ source: 'library', selectedSongId: 's1', model: 'xl-sft', variance: 0.9 });
    expect(get().arrange).toMatchObject({ uploadFile: file, model: 'xl-base' });
  });
});

describe('intentOrigin', () => {
  it('claims prompt and lyrics for the tab they were written in', () => {
    get().patch({ genType: 'audio' });
    get().patch({ prompt: 'brighter drums' });
    expect(get().intentOrigin).toBe('audio');

    get().patch({ genType: 'complete' });
    get().patch({ lyrics: '[chorus]' });
    expect(get().intentOrigin).toBe('complete');
  });

  it('is untouched by edits that are not prompt/lyrics', () => {
    get().patch({ prompt: 'a techno track' }); // authored in PROMPT
    get().patch({ genType: 'audio' });
    get().patch({ bpm: 140, title: 'Whatever' });

    // Still flagged as carried from PROMPT — the tab says so, and analyze may overwrite it.
    expect(get().intentOrigin).toBe('prompt');
    expect(get().genType).toBe('audio');
  });
});

describe('load', () => {
  it('replaces the draft wholesale rather than merging into a stale one', () => {
    get().patch({ prompt: 'old prompt', lyrics: 'old lyrics', bpm: 90, title: 'Old Title', formatted: true });
    get().patchAudio({ selectedSongId: 's-old', model: 'old-model' });

    get().load({ genType: 'prompt', prompt: 'new prompt' });

    expect(get().prompt).toBe('new prompt');
    expect(get().lyrics).toBe('');
    expect(get().bpm).toBe(0);
    expect(get().title).toBe('');
    expect(get().formatted).toBe(false);
    expect(get().audio.selectedSongId).toBeNull();
    expect(get().audio.model).toBe('');
  });

  it('opens on the origin tab and marks the text as belonging to it', () => {
    get().load({ genType: 'complete', prompt: 'a full band', reusedFrom: 'Kopf Hoch' });

    expect(get().genType).toBe('complete');
    expect(get().intentOrigin).toBe('complete'); // reused into its own tab, so nothing is "carried"
    expect(get().reusedFrom).toBe('Kopf Hoch');
  });

  it('carries reference-audio conditioning for CreateView to re-apply', () => {
    get().load({ genType: 'prompt', referenceLabel: 'Daniel', audioInfluence: 0.8, styleInfluence: 0.3 });

    expect(get()).toMatchObject({
      referenceLabel: 'Daniel', referenceAudioInfluence: 0.8, referenceStyleInfluence: 0.3,
    });
  });

  it('seeds the COVER slice from a create-cover draft', () => {
    get().load({ genType: 'audio', source: 'library', selectedSongId: 's1' });

    expect(get().genType).toBe('audio');
    expect(get().audio).toMatchObject({ source: 'library', selectedSongId: 's1' });
  });

  it('defaults to PROMPT for a draft that names no tab', () => {
    get().load({ pendingQuery: 'something dreamy' });
    expect(get().genType).toBe('prompt');
    expect(get().pendingQuery).toBe('something dreamy');
  });
});

describe('resume', () => {
  it('keeps a draft in progress and only re-points its destination', () => {
    get().patch({ prompt: 'half-written', lyrics: '[verse]', bpm: 120 });
    get().patchAudio({ selectedSongId: 's1' });

    get().resume('f2', 'Development');

    expect(get()).toMatchObject({ prompt: 'half-written', lyrics: '[verse]', bpm: 120, folderId: 'f2', folderName: 'Development' });
    expect(get().audio.selectedSongId).toBe('s1');
  });

  it('clears the destination when re-entering outside any folder', () => {
    get().resume('f2', 'Development');
    get().resume(undefined, undefined);
    expect(get().folderId).toBeUndefined();
    expect(get().folderName).toBeUndefined();
  });
});

describe('clearPendingQuery', () => {
  it('retires the query so a remount cannot re-run the same LM expansion', () => {
    get().load({ pendingQuery: 'something dreamy' });
    get().clearPendingQuery();
    expect(get().pendingQuery).toBeUndefined();
  });
});
