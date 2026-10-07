import { useEffect, useRef } from 'react';
import type { Folder, Song } from './api';
import type { GenType } from './createDraft';
import { appCommands } from './commandIndex';
import { useCommandStore } from './commandStore';
import { useSongIndexStore } from './songIndexStore';
import { SETTINGS_SECTIONS } from './settingsSections';
import { useSettings } from './settings';
import { convertAbcFile } from './scoreMidi';

interface Nav {
  folders: Folder[];
  openSong: (songId: string) => void;
  openFolder: (folderId: string) => void;
  startCreate: (genType: GenType) => void;
  remake: (song: Song) => void;
  openSettings: (sectionId: string) => void;
}

/** Publishes the palette's app-wide items (songs, folders, Create's start points, Settings'
 * sections) and re-reads the song list each time the palette opens. */
export function useAppCommands(nav: Nav): void {
  const open = useCommandStore((s) => s.open);
  const publish = useCommandStore((s) => s.publish);
  const songs = useSongIndexStore((s) => s.songs);
  const forgeEnabled = useSettings((s) => s.forgeEnabled);
  const navRef = useRef(nav);
  navRef.current = nav;
  const { folders } = nav;

  useEffect(() => {
    if (open) void useSongIndexStore.getState().load();
  }, [open]);

  useEffect(() => {
    const settingsSections = SETTINGS_SECTIONS.filter((s) => s.id !== 'forge' || forgeEnabled);
    const go = navRef;
    publish('app', appCommands({
      songs, folders, settingsSections,
      openSong: (id) => go.current.openSong(id),
      openFolder: (id) => go.current.openFolder(id),
      startCreate: (genType) => go.current.startCreate(genType),
      remake: (song) => go.current.remake(song),
      openSettings: (id) => go.current.openSettings(id),
      convertAbcFile,
    }));
  }, [publish, songs, folders, forgeEnabled]);
}
