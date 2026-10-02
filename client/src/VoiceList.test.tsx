import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Voice } from './api';

// The real preview subscribes to the client-only playback store; only its presence matters here.
vi.mock('./AudioPreview', () => ({ AudioPreview: ({ label }: { label: string }) => <span className="preview">{label}</span> }));
import { VoiceList } from './VoiceList';

const daniel = { id: 'v1', name: 'Daniel', audio_file: 'daniel.wav', duration: 77 } as Voice;
const render = (voices: Voice[], listError = '') => renderToStaticMarkup(
  <VoiceList voices={voices} listError={listError} onRetry={() => {}} onRemove={() => {}} />,
);

describe('VoiceList', () => {
  it('shows a failed load with RETRY, not "No saved voices yet."', () => {
    const html = render([], 'HTTP 502');
    expect(html).toContain('couldn&#x27;t load voices — HTTP 502');
    expect(html).toContain('RETRY');
    expect(html).not.toContain('No saved voices yet.');
  });

  it('says there are none only when the server answered with none', () => {
    const html = render([]);
    expect(html).toContain('No saved voices yet.');
    expect(html).not.toContain('class="error"');
  });

  it('keeps the voices it has on screen when a refresh fails', () => {
    const html = render([daniel], 'Failed to fetch');
    expect(html).toContain('Daniel');
    expect(html).toContain('couldn&#x27;t load voices — Failed to fetch');
  });
});
