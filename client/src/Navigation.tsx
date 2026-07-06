import { createContext, useContext } from 'react';

interface Nav {
  goToSettings: () => void;
}

/** Lets deeply-nested components (e.g. VoicePicker's "MANAGE VOICES" link) navigate to a
 * top-level view without threading callbacks through every intermediate component — same
 * pattern as HeaderSlotContext. */
export const NavigationContext = createContext<Nav>({ goToSettings: () => {} });

export const useNavigation = () => useContext(NavigationContext);
