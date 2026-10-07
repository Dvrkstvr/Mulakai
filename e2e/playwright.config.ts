import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import { PORTS, SCORE_PORTS } from './ports';
import { DATA_ROOT } from './data-dir';

/** The specs that need the SCORE stack (LLM_API_URL and YUE_API_URL set): SCORE (F-028) and the chat (F-051, D-178). */
const SCORE_SPEC = /(score|chat)\.spec\.ts$/;
const SCORE_MODEL = 'qwen3:14b';

// Workers re-evaluate this file; the env guard makes every one of them reuse the main
// process's directory instead of minting their own.
process.env.MULAKAI_E2E_DATA_DIR ??= path.join(DATA_ROOT, String(Date.now()));
const dataDir = process.env.MULAKAI_E2E_DATA_DIR;
const ci = !!process.env.CI;

export default defineConfig({
  testDir: './tests',
  globalSetup: './global-setup.ts',
  // One global generation lock in the app, one song flow per spec.
  fullyParallel: false,
  workers: 1,
  // A stray test.only fails CI. No retries anywhere: a flaky step should show, not be retried away.
  forbidOnly: ci,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: ci
    ? [['list'], ['github'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://127.0.0.1:${PORTS.client}`,
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
    acceptDownloads: true,
  },
  projects: [
    { name: 'chromium', testIgnore: SCORE_SPEC, use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    // SCORE (F-028) and the chat (F-051) run against their own server + Vite, the only ones with LLM_API_URL set.
    {
      name: 'score',
      testMatch: SCORE_SPEC,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, baseURL: `http://127.0.0.1:${SCORE_PORTS.client}` },
    },
  ],
  // Strict ports and no reuse: a process orphaned by a hard-killed earlier run fails this one
  // with "port in use" instead of quietly serving its stale database.
  webServer: [
    {
      command: 'npx tsx fake-acestep/server.ts',
      url: `http://127.0.0.1:${PORTS.fake}/health`,
      env: { FAKE_ACESTEP_PORT: String(PORTS.fake) },
      reuseExistingServer: false,
      stdout: 'pipe',
    },
    {
      command: 'npx tsx src/index.ts',
      cwd: '../server',
      url: `http://127.0.0.1:${PORTS.server}/api/generate/health`,
      env: {
        PORT: String(PORTS.server),
        HOST: '127.0.0.1',
        DATA_DIR: dataDir,
        ACESTEP_API_URL: `http://127.0.0.1:${PORTS.fake}`,
        POLL_INTERVAL_MS: '200',
        // Empty = disabled; keeps a developer's shell env from reaching real services.
        YUE_API_URL: '',
        HEARTMULA_API_URL: '',
        DEMUCS_API_URL: '',
        LYRICS_API_URL: '',
      },
      reuseExistingServer: false,
      stdout: 'pipe',
    },
    {
      command: `npx vite --host 127.0.0.1 --port ${PORTS.client} --strictPort`,
      cwd: '../client',
      url: `http://127.0.0.1:${PORTS.client}`,
      env: { MULAKAI_API_URL: `http://127.0.0.1:${PORTS.server}` },
      reuseExistingServer: false,
    },
    // The SCORE stack: fake Ollama + fake yue-server, then a second server with its own DATA_DIR.
    {
      command: 'npx tsx fake-score/server.ts',
      url: `http://127.0.0.1:${SCORE_PORTS.yue}/health`,
      env: { LLM_MODEL: SCORE_MODEL },
      reuseExistingServer: false,
      stdout: 'pipe',
    },
    {
      command: 'npx tsx src/index.ts',
      cwd: '../server',
      url: `http://127.0.0.1:${SCORE_PORTS.server}/api/generate/health`,
      env: {
        PORT: String(SCORE_PORTS.server),
        HOST: '127.0.0.1',
        DATA_DIR: path.join(dataDir, 'score'),
        ACESTEP_API_URL: `http://127.0.0.1:${PORTS.fake}`,
        POLL_INTERVAL_MS: '200',
        YUE_API_URL: `http://127.0.0.1:${SCORE_PORTS.yue}`,
        YUE_API_KEY: '',
        LLM_API_URL: `http://127.0.0.1:${SCORE_PORTS.ollama}`,
        LLM_MODEL: SCORE_MODEL,
        HEARTMULA_API_URL: '',
        DEMUCS_API_URL: '',
        LYRICS_API_URL: '',
      },
      reuseExistingServer: false,
      stdout: 'pipe',
    },
    {
      command: `npx vite --host 127.0.0.1 --port ${SCORE_PORTS.client} --strictPort`,
      cwd: '../client',
      url: `http://127.0.0.1:${SCORE_PORTS.client}`,
      env: { MULAKAI_API_URL: `http://127.0.0.1:${SCORE_PORTS.server}` },
      reuseExistingServer: false,
    },
  ],
});
