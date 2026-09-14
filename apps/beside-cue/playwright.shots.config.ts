// ============================================================
// Beside Cue store shots — raw store screenshots from the running app
// ============================================================
//
// Run from apps/beside-cue:
//
//   pnpm shots                        # iPhone + Android, all eight screens
//   BESIDE_CUE_SHOTS_IPAD=1 pnpm shots --project ipad-13 # diagnostic
//   pnpm shots -g settings            # matching screens only
//
// Each screen is written as a PNG flattened to 8-bit RGB (store uploads
// reject alpha) to ~/agent-out/beside-cue/<YYYY-MM-DD>/shots/<run>/<project>/, with
// a contact sheet, index.html, beside them. BESIDE_CUE_SHOTS_DIR overrides
// the folder. Nothing is written into the repository: a failed shot leaves
// its trace in $TMPDIR/beside-cue-shots-<port>/.
//
// This is a local tool and never runs in CI: pr-gate.yml runs only
// playwright.config.ts, whose testDir is ./e2e and whose testMatch is
// *.e2e.ts. A store screenshot is judged by eye, not gated.

import { defineConfig } from '@playwright/test'
import { createHash } from 'node:crypto'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const APP_ROOT = fileURLToPath(new URL('.', import.meta.url))

export interface ShotOptions {
  /** Folder that receives <project>/<nn-screen>.png. */
  readonly shotDir: string
}

// The same per-checkout port as playwright.config.ts, so parallel worktrees
// never answer for each other.
function checkoutPort(): number {
  const digest = createHash('sha256').update(process.cwd()).digest()
  return 5200 + (digest.readUInt16BE(0) % 400)
}

const configuredPort = process.env.BESIDE_CUE_SHOTS_PORT
const shotsPort =
  configuredPort === undefined || configuredPort === ''
    ? checkoutPort()
    : Number(configuredPort)

function localDate(date: Date): string {
  return [
    String(date.getFullYear()).padStart(4, '0'),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

// Resolved once in the runner and inherited by the workers and the contact
// sheet, so a run that crosses midnight still writes one folder.
const shotDir =
  process.env.BESIDE_CUE_SHOTS_DIR ||
  join(
    homedir(),
    'agent-out',
    'beside-cue',
    localDate(new Date()),
    'shots',
    new Date().toISOString().replaceAll(':', '-'),
  )
process.env.BESIDE_CUE_SHOTS_DIR = shotDir

// Touch viewports render the shared web UI. Native store/payment surfaces
// are deliberately excluded; these captures do not emulate a native shell.
const DEVICE = {
  isMobile: true,
  hasTouch: true,
  colorScheme: 'light',
  locale: 'en-US',
  timezoneId: 'UTC',
  // A browser-context option with no `use` shortcut: a bare `reducedMotion`
  // key in `use` is silently ignored. store.shots.ts asserts it took.
  contextOptions: { reducedMotion: 'reduce' },
} as const

export default defineConfig<ShotOptions>({
  testDir: './shots',
  testMatch: '*.shots.ts',
  // Out of the checkout: the app's `prettier --check .` would read
  // Playwright's own run files if they sat under apps/beside-cue.
  outputDir: join(tmpdir(), `beside-cue-shots-${shotsPort}`),
  globalTeardown: './shots/contact-sheet.ts',
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: 'list',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: `http://127.0.0.1:${shotsPort}`,
    trace: 'retain-on-failure',
    shotDir,
  },
  projects: [
    {
      // 440 x 956 at 3x = 1320 x 2868, the App Store 6.9-inch iPhone size.
      name: 'iphone-6.9',
      use: {
        ...DEVICE,
        viewport: { width: 440, height: 956 },
        deviceScaleFactor: 3,
      },
    },
    {
      // 360 x 640 at 3x = 1080 x 1920, Google Play's portrait 9:16 target.
      name: 'android-phone',
      use: {
        ...DEVICE,
        viewport: { width: 360, height: 640 },
        deviceScaleFactor: 3,
      },
    },
    ...(process.env.BESIDE_CUE_SHOTS_IPAD === '1'
      ? [
          {
            // Layout diagnostic only: the native app currently targets iPhone.
            name: 'ipad-13',
            use: {
              ...DEVICE,
              viewport: { width: 1032, height: 1376 },
              deviceScaleFactor: 2,
            },
          },
        ]
      : []),
  ],
  webServer: {
    command: `pnpm shots:serve --host 127.0.0.1 --port ${shotsPort} --strictPort`,
    cwd: APP_ROOT,
    url: `http://127.0.0.1:${shotsPort}`,
    // A fresh production bundle is mandatory; never reuse a games-on/dev server.
    reuseExistingServer: false,
    env: {
      VITE_BESIDE_CUE_GAMES: '0',
      VITE_MOCK_PURCHASES: '0',
      VITE_REVIEW_UNLOCK_SHA256: '',
    },
    timeout: 120_000,
  },
})
