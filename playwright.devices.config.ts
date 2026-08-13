// ── Two-device Playwright project ────────────────────────────────────
//
// Separate from playwright.config.ts because it needs a different app and
// a different build. The default project builds with the API disabled and
// jam signaling mocked, which is right for the fifty-odd specs that run
// against one browser and no network — and fatal for these two, which
// exist precisely to cross the seams that mocking hides.
//
// Not in CI yet. It wants two `wrangler dev` processes and a local D1, and
// a test that needs four services running is a test that fails for reasons
// that are not the code's fault until it has been boring for a while. See
// docs/plans/device-sync-followups.md (§E, decision S5) and
// docs/agent/TWO-DEVICE-E2E.md for how to run it.

import { defineConfig, devices } from '@playwright/test'

const appUrl = process.env.E2E_DEVICES_URL ?? 'http://localhost:3002'

export default defineConfig({
  testDir: './src/e2e-devices',
  // Both specs drive two devices apiece against one pair of workers. Run
  // them one at a time: a shared jam worker and a single local D1 are not
  // a thing to have two tests racing over.
  fullyParallel: false,
  workers: 1,
  forbidOnly: process.env.CI !== undefined,
  retries: 0,
  reporter: [['list']],
  // Packing a song is a real decode and re-encode, and on desktop Linux
  // the encoder is wasm. A minute is not slack, it is the work.
  timeout: 180_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: appUrl,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
