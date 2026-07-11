import { useState, type ReactNode } from 'react';

interface Props {
  accept: string;
  disabled?: boolean;
  onFile: (file: File) => void;
  children: ReactNode;
}

/** File `<label>` that also accepts drag-and-drop. Without preventDefault on dragover/drop,
 * the browser's default is to navigate to/open the dropped file instead of handing it to us. */
export function Dropzone({ accept, disabled, onFile, children }: Props) {
  const [over, setOver] = useState(false);

  const stop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <label
      className={over ? 'dropzone drag-over' : 'dropzone'}
      onDragOver={(e) => { stop(e); if (!disabled) setOver(true); }}
      onDragLeave={(e) => { stop(e); setOver(false); }}
      onDrop={(e) => {
        stop(e);
        setOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file && !disabled) onFile(file);
      }}
    >
      <input
        type="file"
        accept={accept}
        style={{ display: 'none' }}
        disabled={disabled}
        onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
      />
      {children}
    </label>
  );
}
