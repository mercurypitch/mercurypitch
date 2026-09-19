// ============================================================
// Beside Cue Playwright — real-browser interaction gate
// ============================================================
//
// The root Playwright project serves MercuryPitch, not this standalone app.
// Keep Beside Cue on its own Vite dev server so the development-only devSeed
// seam can boot a fresh browser directly into a completed first run.

import { defineConfig, devices } from '@playwright/test'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'

const APP_ROOT = fileURLToPath(new URL('.', import.meta.url))

function checkoutPort(): number {
  const digest = createHash('sha256').update(process.cwd()).digest()
  return 5200 + (digest.readUInt16BE(0) % 400)
}

const configuredPort = process.env.BESIDE_CUE_E2E_PORT
const e2ePort =
  configuredPort === undefined || configuredPort === ''
    ? checkoutPort()
    : Number(configuredPort)
// A separate process and port prevent reuse of the other build mode.
const storePort = e2ePort + 1000

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  fullyParallel: true,
  forbidOnly: process.env.CI !== undefined,
  retries: process.env.CI !== undefined ? 2 : 0,
  workers: 1,
  reporter: 'list',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL: `http://127.0.0.1:${e2ePort}`,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      testIgnore: ['**/games-off.e2e.ts', '**/glass-adventure-*.e2e.ts'],
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'chromium-adventure',
      testMatch: '**/glass-adventure-*.e2e.ts',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'chromium-store',
      testMatch: '**/games-off.e2e.ts',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: `http://127.0.0.1:${storePort}`,
      },
    },
    // Opt in locally to the Safari-engine gate; routine CI installs Chromium.
    ...(process.env.BESIDE_CUE_WEBKIT === '1'
      ? [
          {
            name: 'webkit',
            testIgnore: '**/games-off.e2e.ts',
            use: { ...devices['Desktop Safari'] },
          },
        ]
      : []),
  ],
  webServer: [
    {
      command: `node node_modules/vite/bin/vite.js --host 127.0.0.1 --port ${e2ePort} --strictPort`,
      cwd: APP_ROOT,
      env: { VITE_BESIDE_CUE_GAMES: '1' },
      url: `http://127.0.0.1:${e2ePort}`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: `node node_modules/vite/bin/vite.js --host 127.0.0.1 --port ${storePort} --strictPort`,
      cwd: APP_ROOT,
      env: { VITE_BESIDE_CUE_GAMES: '0' },
      url: `http://127.0.0.1:${storePort}`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
})
