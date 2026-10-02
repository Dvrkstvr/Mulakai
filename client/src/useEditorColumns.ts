import { useResizableWidth } from './useResizableWidth';

/** The Editor's resizable left-rail / main / right-rail grid. */
export function useEditorColumns() {
  const leftWidth = useResizableWidth({ storageKey: 'mulakai:editorLeftWidth', default: 210, min: 180, max: 420, growsToward: 'right' });
  const railWidth = useResizableWidth({ storageKey: 'mulakai:editorRailWidth', default: 300, min: 240, max: 520, growsToward: 'left' });
  const gridTemplateColumns = `${leftWidth.width}px 1fr ${railWidth.width}px`;
  return { leftWidth, railWidth, gridTemplateColumns };
}
