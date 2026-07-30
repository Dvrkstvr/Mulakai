/** Shown by the COVER/ARRANGE tabs when REUSE PROMPT brought a draft over from a song
 * those tabs made: the prompt, lyrics and song details carry, but the source track that
 * conditioned the original render doesn't exist any more (uploads aren't kept, library
 * bounces are made on the fly), so the missing half is stated instead of leaving a
 * silently un-generatable form. Hidden once a source is picked. */
export function ReusedSourceNote({ title, satisfied }: { title?: string; satisfied: boolean }) {
  if (!title || satisfied) return null;
  return (
    <div className="hint">
      Reusing &ldquo;{title}&rdquo;&#39;s prompt and song details — its source audio isn&#39;t stored,
      so pick a source below.
    </div>
  );
}
