/** What the command palette lists (PLAN.md "UI Redesign", S3.1–S3.2): the app-wide items built
 * from songs, folders, Create's start points and Settings' sections, and the grouped, filtered,
 * scoped result list the palette renders. Views publish their own items through commandStore. */
import type { Folder, Song } from './api';
import type { GenType } from './createDraft';
import type { Command, CommandGroup } from './commandStore';
import { matchScore } from './commandMatch';

export const GROUP_ORDER: CommandGroup[] = ['DO', 'OPEN', 'CREATE', 'SETTINGS'];
export const MAX_PER_GROUP = 8;

export interface SettingsSection { id: string; label: string; sub: string }

export interface AppCommandDeps {
  songs: Song[];
  folders: Folder[];
  settingsSections: SettingsSection[];
  openSong: (songId: string) => void;
  openFolder: (folderId: string) => void;
  startCreate: (genType: GenType) => void;
  remake: (song: Song) => void;
  openSettings: (sectionId: string) => void;
}

/** Create's three START FROM cards, by the names S2 gives them. */
const START_FROM: { genType: GenType; label: string; sub: string }[] = [
  { genType: 'prompt', label: 'Start from an idea', sub: 'describe it, the planner writes the rest' },
  { genType: 'audio', label: 'Start from a song I have', sub: 'a cover of a recording' },
  { genType: 'complete', label: 'Start from one track', sub: 'a band built around it' },
];

export function appCommands(d: AppCommandDeps): Command[] {
  return [
    ...d.songs.map((s): Command => ({
      id: `song:${s.id}`, group: 'OPEN', label: s.title, sub: 'song', run: () => d.openSong(s.id),
    })),
    ...d.folders.map((f): Command => ({
      id: `folder:${f.id}`, group: 'OPEN', label: f.name,
      sub: `folder · ${f.song_count} song${f.song_count === 1 ? '' : 's'}`, run: () => d.openFolder(f.id),
    })),
    ...START_FROM.map((c): Command => ({
      id: `create:${c.genType}`, group: 'CREATE', label: c.label, sub: c.sub, run: () => d.startCreate(c.genType),
    })),
    ...d.songs.map((s): Command => ({
      id: `remake:${s.id}`, group: 'CREATE', label: `Remake ${s.title}`, sub: 'create cover from audio',
      run: () => d.remake(s),
    })),
    ...d.settingsSections.map((sec): Command => ({
      id: `settings:${sec.id}`, group: 'SETTINGS', label: sec.label, sub: sec.sub, run: () => d.openSettings(sec.id),
    })),
  ];
}

/** Every published item, or only the scoping view's own while the palette is scoped. */
export function visibleCommands(
  sources: Record<string, Command[]>, scope: { source: string } | null, scoped: boolean,
): Command[] {
  if (scoped && scope) return sources[scope.source] ?? [];
  return Object.values(sources).flat();
}

export interface ResultGroup { group: CommandGroup; items: Command[] }

/** The label is matched as a subsequence; the sub line only as a plain substring, ranked below
 * any label match, since a long description contains almost any short subsequence. */
function itemScore(c: Command, query: string): number | null {
  const label = matchScore(query, c.label);
  if (label !== null) return label + 1;
  const q = query.trim().toLowerCase();
  return c.sub && q && c.sub.toLowerCase().includes(q) ? 0 : null;
}

/** Groups in a fixed order; within a group, the best matches first (published order on an
 * empty query), at most MAX_PER_GROUP each. Empty groups are left out. */
export function paletteResults(commands: Command[], query: string): ResultGroup[] {
  return GROUP_ORDER.map((group) => {
    const scored = commands
      .filter((c) => c.group === group)
      .map((c, i) => ({ c, i, score: itemScore(c, query) }))
      .filter((r): r is { c: Command; i: number; score: number } => r.score !== null);
    scored.sort((a, b) => b.score - a.score || a.i - b.i);
    return { group, items: scored.slice(0, MAX_PER_GROUP).map((r) => r.c) };
  }).filter((g) => g.items.length > 0);
}
