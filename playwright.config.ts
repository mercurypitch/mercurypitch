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
    command: `npm run build && npx serve dist -l ${process.env.VITE_E2E_PORT || 3001}`,
    url: `http://localhost:${process.env.VITE_E2E_PORT || 3001}`,
    reuseExistingServer: true,
    timeout: process.env.VITE_E2E_WEBSERVER_TIMEOUT ? Number(process.env.VITE_E2E_WEBSERVER_TIMEOUT) : 120000,
  },
})
