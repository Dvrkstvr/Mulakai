import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Song, Voice } from './api';

// The real preview subscribes to the client-only playback store; only its presence matters here.
vi.mock('./AudioPreview', () => ({ AudioPreview: ({ label }: { label: string }) => <span className="preview">{label}</span> }));
import { ReferenceAudioMeta } from './ReferenceAudioMeta';

const song = { id: 's1', reference_audio_label: 'Daniel', reference_style_influence: 0.6 } as Song;
const daniel = { id: 'v1', name: 'Daniel', audio_file: 'daniel.wav', duration: 77 } as Voice;
const render = (voice: Voice | null, voicesError = '') => renderToStaticMarkup(
  <ReferenceAudioMeta song={song} voice={voice} voicesError={voicesError} onRetry={() => {}} />,
);

describe('ReferenceAudioMeta', () => {
  it("shows a failed voice list with RETRY and keeps the song's own label", () => {
    const html = render(null, "couldn't load voices — HTTP 502");
    expect(html).toContain('Daniel — style 60%');
    expect(html).toContain('couldn&#x27;t load voices — HTTP 502');
    expect(html).toContain('RETRY');
  });

  it('shows the preview and no error once the voice is found', () => {
    const html = render(daniel);
    expect(html).toContain('rail-preview');
    expect(html).not.toContain('class="error"');
  });
});
