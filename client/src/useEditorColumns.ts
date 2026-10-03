import { useResizableWidth } from './useResizableWidth';

/** The Editor's main column / resizable VERSIONS rail grid. */
export function useEditorColumns() {
  const railWidth = useResizableWidth({ storageKey: 'mulakai:editorRailWidth', default: 300, min: 240, max: 520, growsToward: 'left' });
  const gridTemplateColumns = `minmax(0, 1fr) ${railWidth.width}px`;
  return { railWidth, gridTemplateColumns };
}
