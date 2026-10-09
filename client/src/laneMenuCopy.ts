/** The lane ⋯ menu's words (PLAN.md "Editor Redesign", PR 3). Pure. */

/** The delete confirmation names what goes. */
export function deleteLayerLine(name: string, takes: number): string {
  return `Deletes ${name.toUpperCase()} and its ${takes === 1 ? 'take' : `${takes} takes`} · this can't be undone`;
}

export const BASE_UNDELETABLE = "the base layer can't be deleted";
