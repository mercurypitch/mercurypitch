// ── Cloud-enabled Playwright project ─────────────────────────────────
//
// Separate from playwright.config.ts because it needs a different BUILD.
// The default project builds with `VITE_API_BASE_URL=` empty so the suite
// exercises the local IndexedDB path — which is right for the fifty-odd
// specs that assert against Dexie, and fatal for anything about account
// sync: `cloudAvailable()` is false, so every cloud path no-ops and a
// test asserting one would pass while asserting nothing.
//
// This is why onboarding-mic.spec.ts says the account path "stays manual
// for now". It does not have to. The API base points at an origin nothing
// is listening on and every call is answered by `page.route()`, so these
// specs need no worker, no D1 and no network — just a build that believes
// there is a cloud.
//
// Not folded into the default config as a second project: `webServer` is
// per-config, and two builds in one config would serialise every run.

import { defineConfig, devices } from '@playwright/test'

const port = Number(process.env.VITE_E2E_CLOUD_PORT ?? 3003)

export default defineConfig({
  testDir: './src/e2e-cloud',
  fullyParallel: true,
  forbidOnly: process.env.CI !== undefined,
  retries: process.env.CI !== undefined ? 2 : 0,
  reporter: [['list']],
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL: `http://localhost:${port}`,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // The API base is same-origin and deliberately unserved: `page.route()`
    // answers it before the network is reached. Ads/GA4 stay empty for the
    // same reason the default config empties them — a headless run must not
    // fire real hits into production.
    command: `cross-env VITE_API_BASE_URL=http://localhost:${port}/cloud VITE_GOOGLE_ADS_TAG_ID= VITE_GA4_MEASUREMENT_ID= VITE_JAM_MOCK_SIGNALING=1 pnpm run build && pnpm dlx serve dist -l ${port}`,
    url: `http://localhost:${port}`,
    reuseExistingServer: true,
    timeout: 180_000,
  },
})
