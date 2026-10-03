import type { SettingsSection } from './commandIndex';

/** Settings' sections in page order, as the command palette lists them. SettingsView anchors
 * each card at `settingsAnchor(id)` so an item can land on it. */
export const SETTINGS_SECTIONS: SettingsSection[] = [
  { id: 'models', label: 'Models', sub: 'DiT and LM models, the default for new songs' },
  { id: 'adapters', label: 'Adapters', sub: 'LoRA / LoKr adapters and their strength' },
  { id: 'engines', label: 'Engines', sub: 'extra song-creation engines and their status' },
  { id: 'playback', label: 'Playback & Export', sub: 'volume on load, export format, remaster steps' },
  { id: 'voices', label: 'Voices', sub: 'upload, rename, delete reference vocals' },
  { id: 'maintenance', label: 'Library Maintenance', sub: 'storage, trash, empty trash now' },
  { id: 'forge', label: 'Forge (experimental)', sub: 'the FORGE screen toggle' },
  { id: 'metadata', label: 'Output file metadata', sub: 'artist, encoder, ID3 version' },
  { id: 'tag-guide', label: 'Lyric tag guide', sub: 'how structure and performance tags work' },
  { id: 'tags', label: 'Lyric tags', sub: 'tags seen in ACE-Step output' },
];

export const settingsAnchor = (id: string) => `settings-${id}`;

const MAX_FRAMES = 60;

/** Scrolls a section into view once the Settings view has mounted it (navigating there takes
 * a view transition, so the card may not exist yet on the first frame). */
export function scrollToSettingsSection(id: string, frame = 0): void {
  const el = document.getElementById(settingsAnchor(id));
  if (el) el.scrollIntoView({ block: 'start', behavior: 'smooth' });
  else if (frame < MAX_FRAMES) requestAnimationFrame(() => scrollToSettingsSection(id, frame + 1));
}
