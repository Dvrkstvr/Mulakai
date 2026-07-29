import { useEffect, useState } from 'react';
import { evictPeaks } from './waveformPeaks';

/**
 * Object URL for a not-yet-uploaded file so it can be previewed in place
 * (DESIGN.md "Audio preview module"). Revokes the URL and drops its cached
 * waveform peaks when the file changes or the caller unmounts.
 */
export function useObjectUrl(file: File | Blob | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file) {
      setUrl(null);
      return;
    }
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => {
      evictPeaks(u);
      URL.revokeObjectURL(u);
    };
  }, [file]);
  return url;
}
