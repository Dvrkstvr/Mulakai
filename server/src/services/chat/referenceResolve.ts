/**
 * Which reference an `analyze` reply means (F-061; architecture "Chat (C3)" flow 2), pure: the user
 * message's `attach` first; then the name the model wrote against the thread's attached files and the
 * library titles, exact before any case (surrounding quotes ignored); then the thread's only attached
 * file (the model wrote "the attached file"). Two matches at one level are a reason, never a guess. A
 * library song this thread already copied resolves to its copy.
 */
import type { AnalyzeTarget } from './chatTypes.js';

export interface ThreadReference { id: string; name: string; sourceSongId: string | null }
export interface LibrarySong { id: string; title: string }
export interface ResolveInput {
  /** `analyze.reference`, as the model wrote it. */
  named: string;
  /** The user message's `attach.referenceId`, or null. */
  attach: string | null;
  references: ThreadReference[];
  library: LibrarySong[];
}
export type Resolved = AnalyzeTarget | { reason: string };

const exact = (a: string, b: string) => a.trim() === b.trim();
const loose = (a: string, b: string) => a.trim().replace(/^["'“”]+|["'“”]+$/g, '').trim().toLowerCase() === b.trim().toLowerCase();

export function resolveReference({ named, attach, references, library }: ResolveInput): Resolved {
  if (attach && references.some((r) => r.id === attach)) return { referenceId: attach };
  for (const same of [exact, loose]) {
    const files = references.filter((r) => same(named, r.name));
    if (files.length === 1) return { referenceId: files[0].id };
    if (files.length > 1) return { reason: `${files.length} attached files are called "${named.trim()}": say which one` };
    const songs = library.filter((s) => same(named, s.title));
    if (songs.length > 1) return { reason: `${songs.length} songs in the library are called "${named.trim()}": say which one` };
    if (songs.length === 1) {
      const copy = references.find((r) => r.sourceSongId === songs[0].id);
      return copy ? { referenceId: copy.id } : { songId: songs[0].id };
    }
  }
  if (references.length === 1) return { referenceId: references[0].id };
  if (references.length > 1) return { reason: `${references.length} files are attached and "${named.trim()}" names none of them: say which one` };
  return { reason: `nothing called "${named.trim()}" is attached or in the library` };
}
