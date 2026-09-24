// Reproduce the Cloudway host proof against an already-running compiled preview.
import { fileURLToPath } from 'node:url'
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: fileURLToPath(
    new URL('../../../../../../apps/beside-cue/e2e', import.meta.url),
  ),
  testMatch: 'glass-adventure-cloudway.e2e.ts',
  outputDir:
    process.env.GLASS_PROOF_OUTPUT ?? '/tmp/cloudway-compiled-entry-results',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  timeout: 120000,
  expect: { timeout: 10000 },
  use: {
    ...devices['Desktop Chrome'],
    baseURL: process.env.GLASS_PROOF_URL ?? 'http://127.0.0.1:5302',
    trace: 'retain-on-failure',
  },
})
