import { describe, it, expect, beforeEach } from 'vitest';
import { useCreateDraftStore, isDraftEmpty } from './createDraftStore';

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

describe('clear', () => {
  it('empties every shared field and both method slices', () => {
    get().patch({ title: 'T', prompt: 'p', lyrics: 'l', bpm: 120, keyScale: 'A minor', timeSignature: '4/4', vocalLanguage: 'en', duration: 90, formatted: true });
    get().patchAudio({ source: 'library', selectedSongId: 's1', uploadFile: new File(['x'], 'a.wav'), variance: 0.9 });
    get().patchArrange({ source: 'split', scratchSource: { jobId: 'j1', kind: 'vocals' }, uploadFile: new File(['x'], 'b.wav') });

    get().clear();

    expect(isDraftEmpty(get())).toBe(true);
    expect(get()).toMatchObject({ title: '', prompt: '', lyrics: '', bpm: 0, keyScale: '', timeSignature: '', vocalLanguage: '', duration: 0, formatted: false });
    expect(get().audio).toMatchObject({ source: 'upload', selectedSongId: null, uploadFile: null, variance: 0.5 });
    expect(get().arrange).toMatchObject({ source: 'upload', scratchSource: null, uploadFile: null });
  });

  it('keeps the destination folder — it came from the Library, not from anything typed', () => {
    get().load({ genType: 'prompt', prompt: 'p', folderId: 'f1', folderName: 'Development' });
    get().clear();
    expect(get()).toMatchObject({ folderId: 'f1', folderName: 'Development' });
  });

  it('stays on the tab in view rather than jumping back to PROMPT', () => {
    get().patch({ genType: 'complete', prompt: 'p' });
    get().clear();
    expect(get().genType).toBe('complete');
    expect(get().intentOrigin).toBe('complete'); // nothing left to have been carried from elsewhere
  });

  it('drops a reused song\'s leftovers so the emptied draft claims nothing', () => {
    get().load({ genType: 'audio', prompt: 'p', reusedFrom: 'Kopf Hoch', referenceLabel: 'Daniel', audioInfluence: 0.8 });
    get().clear();
    expect(get().reusedFrom).toBeUndefined();
    expect(get().referenceLabel).toBeUndefined();
    expect(get().referenceAudioInfluence).toBeUndefined();
  });

  it('bumps revision so the folder-title suggestion is offered again', () => {
    get().load({ genType: 'prompt', prompt: 'p', folderId: 'f1' });
    const before = get().revision;
    get().clear();
    expect(get().revision).toBe(before + 1);
  });
});

describe('isDraftEmpty', () => {
  it('is true for an untouched draft, and for one holding only a destination', () => {
    expect(isDraftEmpty(get())).toBe(true);
    get().resume('f1', 'Development');
    expect(isDraftEmpty(get())).toBe(true);
  });

  // Clearing inside a folder re-offers the folder-name title, and a suggestion the user hasn't
  // touched isn't a draft — otherwise CLEAR DRAFT stays lit with nothing left to clear.
  it('ignores a title that is only the folder suggestion, but not one that was typed', () => {
    get().patch({ title: 'Development 1', titleSuggested: true });
    expect(isDraftEmpty(get())).toBe(true);

    get().patch({ title: 'Development 1', titleSuggested: false });
    expect(isDraftEmpty(get())).toBe(false);
  });

  // Both auto-populate (model on mount, variance at 0.5), so counting them would leave CLEAR
  // DRAFT permanently enabled on a draft with nothing in it.
  it('ignores each tab\'s auto-selected model and default variance', () => {
    get().patchAudio({ model: 'acestep-v15-xl-sft', variance: 0.5 });
    get().patchArrange({ model: 'acestep-v15-xl-base' });
    expect(isDraftEmpty(get())).toBe(true);
  });

  it('is false once anything has actually been entered or picked', () => {
    get().patch({ prompt: 'a techno track' });
    expect(isDraftEmpty(get())).toBe(false);

    get().clear();
    get().patchAudio({ selectedSongId: 's1' });
    expect(isDraftEmpty(get())).toBe(false);

    get().clear();
    get().patchArrange({ scratchSource: { jobId: 'j1', kind: 'drums' } });
    expect(isDraftEmpty(get())).toBe(false);
  });
});
