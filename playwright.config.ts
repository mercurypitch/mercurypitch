import { defineConfig, devices } from '@playwright/test'
import { loadEnv } from 'vite'

// Use Vite's built-in loadEnv to parse .env and .env.local without needing the dotenv package
const env = loadEnv('', process.cwd(), '')
Object.assign(process.env, env)

export default defineConfig({
  testDir: './src/e2e',
  fullyParallel: true,
  forbidOnly: process.env.CI !== undefined,
  retries: process.env.CI !== undefined ? 2 : 0,
  workers: process.env.CI !== undefined ? 4 : undefined,
  reporter: 'html',
  timeout: process.env.VITE_E2E_TIMEOUT ? Number(process.env.VITE_E2E_TIMEOUT) : 30000,
  expect: {
    timeout: process.env.VITE_E2E_EXPECT_TIMEOUT ? Number(process.env.VITE_E2E_EXPECT_TIMEOUT) : 5000,
  },
  use: {
    // Use production build served on e2e port (default 3001)
    baseURL: `http://localhost:${process.env.VITE_E2E_PORT || 3001}`,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    // Build with the cloud API disabled so e2e exercises the local IndexedDB
    // (DexieAdapter) path it asserts against. e2e runs offline, and .env.production
    // now sets VITE_API_BASE_URL (HybridAdapter), whose stores aren't seeded locally.
    // Also empty the Ads/GA4 ids so the headless-browser e2e build stays inert —
    // otherwise every CI run fires real GA4 hits (hostName=localhost) into prod.
    command: `cross-env VITE_API_BASE_URL= VITE_GOOGLE_ADS_TAG_ID= VITE_GA4_MEASUREMENT_ID= pnpm run build && pnpm dlx serve dist -l ${process.env.VITE_E2E_PORT || 3001}`,
    url: `http://localhost:${process.env.VITE_E2E_PORT || 3001}`,
    reuseExistingServer: true,
    timeout: process.env.VITE_E2E_WEBSERVER_TIMEOUT ? Number(process.env.VITE_E2E_WEBSERVER_TIMEOUT) : 120000,
  },
})
