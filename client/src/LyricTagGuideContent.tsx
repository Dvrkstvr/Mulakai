import { type LyricTag } from './api';
import { buildTagGuide, type Cluster } from './lyricTagGuide';

function ClusterRows({ clusters }: { clusters: Cluster[] }) {
  return (
    <div className="settings-model-list">
      {clusters.map((c) => (
        <div key={c.label} className="settings-model-row">
          <div>
            <div className="settings-model-name">[{c.label}]</div>
            {c.examples.length > 0 && (
              <div className="hint">e.g. {c.examples.map((e) => `[${e}]`).join('  ·  ')}</div>
            )}
          </div>
          <span className="hint">{c.count}&times;</span>
        </div>
      ))}
    </div>
  );
}

/** Curated read of the raw probed tag data (LYRIC TAGS in Settings) — most of the long tail
 * is the same handful of concepts wearing different filler text ("Vocal ad-lib: Woo!" vs
 * "Vocal ad-lib: Rrrra!"), so this teaches the small set of primitives and the combining
 * pattern instead of a flat 200-entry list. Shared between the Settings reference card and
 * the Create-flow flyout so both stay in sync off one source of truth. */
export function LyricTagGuideContent({ tags }: { tags: LyricTag[] }) {
  const guide = buildTagGuide(tags);
  const hasAny = guide.structure.length > 0 || guide.vocalDelivery.length > 0 || guide.instrumentation.length > 0;

  if (!hasAny) {
    return <div className="empty">No probed data yet — run a probe in LYRIC TAGS (Settings).</div>;
  }

  return (
    <>
      {guide.structure.length > 0 && (
        <>
          <div className="section-label" style={{ marginTop: 12 }}>SONG STRUCTURE</div>
          <div className="hint">
            The core section markers, most-used first. Append &ldquo; - &rdquo; or &ldquo;: &rdquo; to
            name the instrumentation or vocalist, e.g. [Chorus: Male Lead &amp; Choir] or
            [Intro - Guitar &amp; Organ Riff].
          </div>
          <ClusterRows clusters={guide.structure} />
        </>
      )}

      {guide.vocalDelivery.length > 0 && (
        <>
          <div className="section-label" style={{ marginTop: 12 }}>VOCAL DELIVERY</div>
          <div className="hint">How a line or section should be performed, used inline or as its own tag.</div>
          <ClusterRows clusters={guide.vocalDelivery} />
        </>
      )}

      {guide.transitions.length > 0 && (
        <>
          <div className="section-label" style={{ marginTop: 12 }}>TRANSITIONS &amp; ENDINGS</div>
          <div className="hint">Closing/handoff cues, usually the last tag in a song or section.</div>
          <ClusterRows clusters={guide.transitions} />
        </>
      )}

      {guide.languageCodes.length > 0 && (
        <>
          <div className="section-label" style={{ marginTop: 12 }}>LANGUAGE SWITCHING?</div>
          <div className="hint">
            Bare two-letter tags — not confirmed by any ACE-Step doc, but they correlate with
            multilingual prompts (K-pop, etc.), consistent with marking a language switch mid-lyric.
          </div>
          <div className="settings-model-list">
            {guide.languageCodes.map((t) => (
              <div key={t.tag} className="settings-model-row">
                <div className="settings-model-name">[{t.tag}]</div>
                <span className="hint">{t.count}&times;</span>
              </div>
            ))}
          </div>
        </>
      )}

      {guide.instrumentation.length > 0 && (
        <>
          <div className="section-label" style={{ marginTop: 12 }}>INSTRUMENTATION &amp; FX</div>
          <div className="hint">Free-text descriptive cues, not a fixed vocabulary — just plain English in brackets.</div>
          <ClusterRows clusters={guide.instrumentation} />
        </>
      )}
    </>
  );
}
