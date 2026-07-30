import { createContext, useContext } from 'react';

interface Nav {
  goToSettings: () => void;
  /** Opens the editor on a song from anywhere, closing whichever takeover view is up —
   * used by Create's MOVE TO EDITOR, which lands you on the song it just imported. */
  openEditor: (songId: string) => void;
}

/** Lets deeply-nested components (e.g. VoicePicker's "MANAGE VOICES" link) navigate to a
 * top-level view without threading callbacks through every intermediate component — same
 * pattern as HeaderSlotContext. */
export const NavigationContext = createContext<Nav>({ goToSettings: () => {}, openEditor: () => {} });

export const useNavigation = () => useContext(NavigationContext);
