/** The subset of a Create draft an import carries onto the new song. Structural rather than
 * `Pick<CreateDraftState, …>` so this stays testable without pulling in the store. */
export interface ImportDraft {
  title: string;
  prompt: string;
  lyrics: string;
  bpm: number;       // 0 = unknown
  keyScale: string;  // '' = unknown
  duration: number;  // 0 = unknown
  folderId?: string;
}

/**
 * Draft -> `/api/songs/import` form fields. Blank and zero fields are dropped rather than
 * sent, so the server's own fallbacks apply (title from the filename, null metadata) instead
 * of persisting `""`/`0` as if they were known values — `bpm: 0` in particular would show up
 * in the detail rail and get stamped into the output file's tags.
 *
 * `measuredDuration` wins over the draft's `duration` when available: the draft field is the
 * *target* length for a generation, while for an import the file's real length is the truth.
 */
export function importFields(draft: ImportDraft, measuredDuration?: number): Record<string, string> {
  const duration = measuredDuration ?? (draft.duration > 0 ? draft.duration : undefined);
  const fields: Record<string, string> = {};
  const title = draft.title.trim();
  if (title) fields.title = title;
  if (draft.prompt.trim()) fields.prompt = draft.prompt;
  if (draft.lyrics.trim()) fields.lyrics = draft.lyrics;
  if (draft.bpm > 0) fields.bpm = String(draft.bpm);
  if (draft.keyScale) fields.key_scale = draft.keyScale;
  if (duration && duration > 0) fields.duration = String(duration);
  if (draft.folderId) fields.folder_id = draft.folderId;
  return fields;
}
