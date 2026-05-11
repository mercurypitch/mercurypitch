import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './src/e2e',
  fullyParallel: true,
  forbidOnly: process.env.CI !== undefined,
  retries: process.env.CI !== undefined ? 2 : 0,
  workers: process.env.CI !== undefined ? 4 : undefined,
  reporter: 'html',
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
    command: `pnpm run build && pnpm dlx serve dist -l ${process.env.VITE_E2E_PORT || 3001}`,
    url: `http://localhost:${process.env.VITE_E2E_PORT || 3001}`,
    reuseExistingServer: true,
    timeout: 120000,
  },
})
