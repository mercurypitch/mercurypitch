import { defineConfig, devices } from '@playwright/test'
import { loadEnv } from 'vite'

// Use Vite's built-in loadEnv to parse .env and .env.local without needing the dotenv package
const env = loadEnv('', process.cwd(), '')
Object.assign(process.env, env)

function numericEnv(value: string | undefined, fallback: number): number {
  return value === undefined || value === '' ? fallback : Number(value)
}

const e2ePort = numericEnv(process.env.VITE_E2E_PORT, 3001)

export default defineConfig({
  testDir: './src/e2e',
  fullyParallel: true,
  forbidOnly: process.env.CI !== undefined,
  retries: process.env.CI !== undefined ? 2 : 0,
  workers: process.env.CI !== undefined ? 4 : undefined,
  reporter: 'html',
  timeout: numericEnv(process.env.VITE_E2E_TIMEOUT, 30000),
  expect: {
    timeout: numericEnv(process.env.VITE_E2E_EXPECT_TIMEOUT, 5000),
  },
  use: {
    // Use production build served on e2e port (default 3001)
    baseURL: `http://localhost:${e2ePort}`,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    // Serve only — the build is `pnpm run build:e2e`, which carries the env this
    // suite needs (cloud API disabled so e2e exercises the local IndexedDB path;
    // Ads/GA4 ids emptied so headless runs do not fire real GA4 hits into prod)
    // and then audits the emitted bundle.
    //
    // Building here as well overwrote that audited bundle with a second,
    // differently-configured one before a single test ran, so
    // `assert-piano-night-bundle.mjs` was describing a build nobody served.
    // CI now builds once and shares `dist` across every shard; locally,
    // `pnpm run build:e2e` is the prerequisite.
    //
    // No `--single`: the app ships eight HTML entry points (karaoke, jam,
    // guitar-night, piano-night, glass, mirror, vocal-range-test, index) and
    // SPA-rewriting them all to index.html would break every one but the first.
    command: `pnpm exec serve dist -l ${e2ePort}`,
    url: `http://localhost:${e2ePort}`,
    reuseExistingServer: true,
    timeout: numericEnv(process.env.VITE_E2E_WEBSERVER_TIMEOUT, 120000),
  },
})
