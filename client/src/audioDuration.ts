/**
 * Reads an audio file's duration in the browser. There is no server-side audio probing
 * anywhere in this project (see server/src/routes/voices.ts), so every path that needs a
 * duration for a file the user supplied measures it here and sends it along.
 * Resolves `undefined` rather than rejecting — a duration we couldn't read is stored as
 * null, which is already the "unknown" case everywhere downstream.
 */
export function readDuration(file: File): Promise<number | undefined> {
  return new Promise((resolve) => {
    const el = document.createElement('audio');
    el.preload = 'metadata';
    el.onloadedmetadata = () => {
      URL.revokeObjectURL(el.src);
      resolve(Number.isFinite(el.duration) ? el.duration : undefined);
    };
    el.onerror = () => resolve(undefined);
    el.src = URL.createObjectURL(file);
  });
}
