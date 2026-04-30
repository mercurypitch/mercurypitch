import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './src/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    // Vite dev server is HTTPS via @vitejs/plugin-basic-ssl on port 3000.
    baseURL: 'https://localhost:3000',
    ignoreHTTPSErrors: true,
    trace: 'on-first-retry',
    /* Mark as E2E mode so exposeForE2E() registers window.__appStore etc. */
    addInitScript: () => { (window as any).E2E_TEST_MODE = true },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    // The vite dev server runs on port 3000 (configured in vite.config.ts) over
    // HTTPS via the basic SSL plugin. Playwright was previously pointed at
    // http://localhost:3001 — wrong port AND wrong protocol — so the
    // webServer wait would timeout after 30s.
    url: 'https://localhost:3000',
    reuseExistingServer: true,
    timeout: 60000,
    ignoreHTTPSErrors: true,
  },
})
