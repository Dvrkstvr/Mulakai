import { useEffect, useState } from 'react';
import { api, type LyricTag } from './api';
import { LyricTagGuideContent } from './LyricTagGuideContent';

/** Settings-anchored reference card — see LyricTagGuideContent for the actual guide, also
 * surfaced from CreateView's LYRICS field via LyricTagGuidePopover. */
export function LyricTagGuideSection() {
  const [tags, setTags] = useState<LyricTag[] | null>(null);

  useEffect(() => {
    api.listLyricTags().then(setTags).catch(() => setTags([]));
  }, []);

  return (
    <div className="settings-card">
      <span className="section-label">LYRIC TAG GUIDE</span>
      <div className="hint">
        How ACE-Step's lyric annotation tags actually work, distilled from probed generations
        (see LYRIC TAGS below) — not a fixed spec, just the patterns that showed up.
      </div>
      {tags === null ? <span className="meta">loading…</span> : <LyricTagGuideContent tags={tags} />}
    </div>
  );
}
