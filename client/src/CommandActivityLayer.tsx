import { useEffect } from 'react';
import type { Folder, Song } from './api';
import type { CreateDraft, GenType } from './createDraft';
import { CommandPalette } from './CommandPalette';
import { ActivityDrawer } from './ActivityDrawer';
import { MidiNotice } from './MidiNotice';
import { trackActivity } from './activityTracking';
import { useAppCommands } from './useAppCommands';
import { useCommandKey } from './useCommandKey';

interface Props {
  folders: Folder[];
  openEditor: (songId: string) => void;
  openFolder: (folderId: string) => void;
  /** Create as it is, on a START FROM card when given. */
  showCreate: (genType?: GenType) => void;
  /** Create, loaded with a draft (REMAKE, a failed generation's RETRY). */
  loadCreate: (draft: CreateDraft) => void;
  remake: (song: Song) => void;
  openSettings: (sectionId: string) => void;
}

/** The Ctrl K palette and the ACTIVITY drawer, plus what feeds them: the app-wide palette
 * items and Activity's settle tracking (PLAN.md "UI Redesign", S3). */
export function CommandActivityLayer(p: Props) {
  useCommandKey();
  useAppCommands({
    folders: p.folders, openSong: p.openEditor, openFolder: p.openFolder,
    startCreate: p.showCreate, remake: p.remake, openSettings: p.openSettings,
  });
  useEffect(() => trackActivity(), []);
  return (
    <>
      <CommandPalette />
      <MidiNotice />
      <ActivityDrawer openEditor={p.openEditor} openCreate={() => p.showCreate()} retryGeneration={p.loadCreate} />
    </>
  );
}
