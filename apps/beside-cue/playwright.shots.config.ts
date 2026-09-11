// ============================================================
// Beside Cue store shots — App Store screenshots from the running app
// ============================================================
//
// Run from apps/beside-cue:
//
//   pnpm shots                        # both devices, all eight screens
//   pnpm shots --project ipad-13      # one device
//   pnpm shots -g settings            # matching screens only
//
// Each screen is written as a PNG flattened to 8-bit RGB (store uploads
// reject alpha) to ~/agent-out/beside-cue/<YYYY-MM-DD>/shots/<project>/, with
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
  /** Stylesheet injected into every document before capture. */
  readonly shotCss: string
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
  join(homedir(), 'agent-out', 'beside-cue', localDate(new Date()), 'shots')
process.env.BESIDE_CUE_SHOTS_DIR = shotDir

// Reduced motion is emulated too, but not every motion rule in the app sits
// behind that query, and a half-finished transition must never be the
// picture. Durations go to zero rather than `animation: none`, so an element
// that animates into its resting state still ends up there.
const SHOT_CSS = `
*, *::before, *::after {
  animation-delay: 0s !important;
  animation-duration: 0s !important;
  animation-iteration-count: 1 !important;
  transition-delay: 0s !important;
  transition-duration: 0s !important;
  scroll-behavior: auto !important;
  caret-color: transparent !important;
}
/* Build identity: the corner chip on every non-release build, and the
   version line at the foot of Settings, which reads "dev · 0.1.0 · <sha>"
   on a dev server. A release shows neither. */
.build-stamp,
.settings-screen__version {
  display: none !important;
}
`

// A phone and a tablet as far as the page can tell: touch, the mobile
// viewport rules, reduced motion. Viewport x DPR is the store's pixel size.
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
    shotCss: SHOT_CSS,
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
      // 1032 x 1376 at 2x = 2064 x 2752, the 13-inch iPad size. The app ships
      // for iPad (TARGETED_DEVICE_FAMILY 1,2), so the store requires this set.
      name: 'ipad-13',
      use: {
        ...DEVICE,
        viewport: { width: 1032, height: 1376 },
        deviceScaleFactor: 2,
      },
    },
  ],
  webServer: {
    command: `node node_modules/vite/bin/vite.js --host 127.0.0.1 --port ${shotsPort} --strictPort`,
    cwd: APP_ROOT,
    url: `http://127.0.0.1:${shotsPort}`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
