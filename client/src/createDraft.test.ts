import { describe, it, expect } from 'vitest';
import { taskToGenType, reusePromptDraft, draftHasIntent } from './createDraft';
import type { Song } from './api';

const song = (over: Partial<Song> = {}): Song => ({
  id: 's1',
  title: 'Neon Freeway',
  caption: 'a driving synthwave track',
  lyrics: '[verse]\nlights',
  bpm: 128,
  key_scale: 'A minor',
  time_signature: '4/4',
  duration: 180,
  favorite: 0,
  audio_file: 'a.wav',
  trashed_at: null,
  created_at: '2026-07-30T00:00:00Z',
  comment: '',
  genre: '',
  album: '',
  cover_art_file: null,
  folder_id: null,
  reference_audio_label: null,
  reference_audio_influence: null,
  reference_style_influence: null,
  gen_task: 'text2music',
  ...over,
});

describe('taskToGenType', () => {
  it('maps each song-creating task to the tab that produces it', () => {
    expect(taskToGenType('text2music')).toBe('prompt');
    expect(taskToGenType('cover')).toBe('audio');
    expect(taskToGenType('complete')).toBe('complete');
  });

  // Songs predating songs.gen_task whose params_json backfill found nothing, plus any task
  // that never creates a song (repaint/lego/extract) — all behave as they did before.
  it('falls back to PROMPT for null, undefined and non-song tasks', () => {
    expect(taskToGenType(null)).toBe('prompt');
    expect(taskToGenType(undefined)).toBe('prompt');
    expect(taskToGenType('repaint')).toBe('prompt');
  });
});

describe('draftHasIntent', () => {
  // Decides load (replace the draft) vs resume (keep it) — see App.tsx's openCreate.
  it('is false for the create bar\'s CREATE on an empty box', () => {
    expect(draftHasIntent({})).toBe(false);
    expect(draftHasIntent({ folderId: 'f1', folderName: 'Development' })).toBe(false);
  });

  it('is true for anything that actually asks for something', () => {
    expect(draftHasIntent({ pendingQuery: 'something dreamy' })).toBe(true);
    expect(draftHasIntent({ genType: 'audio' })).toBe(true);
    expect(draftHasIntent({ prompt: 'a techno track' })).toBe(true);
    expect(draftHasIntent({ selectedSongId: 's1' })).toBe(true);
  });
});

describe('reusePromptDraft', () => {
  it('carries prompt, lyrics and song details', () => {
    expect(reusePromptDraft(song())).toMatchObject({
      genType: 'prompt',
      prompt: 'a driving synthwave track',
      lyrics: '[verse]\nlights',
      bpm: 128,
      keyScale: 'A minor',
      timeSignature: '4/4',
      duration: 180,
    });
  });

  it('opens the tab the song was generated with, not always PROMPT', () => {
    expect(reusePromptDraft(song({ gen_task: 'cover' })).genType).toBe('audio');
    expect(reusePromptDraft(song({ gen_task: 'complete' })).genType).toBe('complete');
    expect(reusePromptDraft(song({ gen_task: null })).genType).toBe('prompt');
  });

  it('flags source-needing tabs with the title being reused, and never preselects a source', () => {
    const cover = reusePromptDraft(song({ gen_task: 'cover' }));
    expect(cover.reusedFrom).toBe('Neon Freeway');
    // CREATE COVER FROM AUDIO is the action that seeds a source; reuse must not become it.
    expect(cover.selectedSongId).toBeUndefined();
    expect(cover.source).toBeUndefined();

    expect(reusePromptDraft(song({ gen_task: 'complete' })).reusedFrom).toBe('Neon Freeway');
    expect(reusePromptDraft(song()).reusedFrom).toBeUndefined();
  });

  it('carries the reference audio that conditioned the song, with its influences', () => {
    const draft = reusePromptDraft(song({
      reference_audio_label: 'Daniel',
      reference_audio_influence: 0.8,
      reference_style_influence: 0.3,
    }));
    expect(draft).toMatchObject({ referenceLabel: 'Daniel', audioInfluence: 0.8, styleInfluence: 0.3 });
  });

  it('carries a cover/arrange origin\'s label without influences it never stored', () => {
    const draft = reusePromptDraft(song({
      gen_task: 'cover',
      reference_audio_label: 'Daniel',
      reference_audio_influence: null,
      reference_style_influence: null,
    }));
    expect(draft.referenceLabel).toBe('Daniel');
    expect(draft).not.toHaveProperty('audioInfluence');
    expect(draft).not.toHaveProperty('styleInfluence');
  });

  it('omits the reference fields entirely for an unconditioned song', () => {
    const draft = reusePromptDraft(song());
    expect(draft).not.toHaveProperty('referenceLabel');
    expect(draft).not.toHaveProperty('audioInfluence');
  });

  it('omits AUTO song details rather than carrying zeroes', () => {
    const draft = reusePromptDraft(song({ bpm: null, key_scale: '', time_signature: '', duration: null }));
    expect(draft).not.toHaveProperty('bpm');
    expect(draft).not.toHaveProperty('keyScale');
    expect(draft).not.toHaveProperty('timeSignature');
    expect(draft).not.toHaveProperty('duration');
  });
});
