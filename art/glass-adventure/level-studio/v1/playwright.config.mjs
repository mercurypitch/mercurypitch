import { defineConfig, devices } from '@playwright/test'

const port = 5633
const studioPath = '/art/glass-adventure/level-studio/v1/index.html'

export default defineConfig({
  testDir: '.',
  testMatch: /level-studio\.spec\.mjs$/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    ...devices['Desktop Chrome'],
    baseURL: `http://127.0.0.1:${port}`,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `node_modules/.bin/vite --config art/glass-adventure/level-studio/v1/vite.config.mjs --host 127.0.0.1 --port ${port} --strictPort`,
    cwd: process.cwd(),
    url: `http://127.0.0.1:${port}${studioPath}`,
    reuseExistingServer: true,
    timeout: 60_000,
  },
})
