// ============================================================
// Mercury Pitch store shots — raw store screenshots from the running app
// ============================================================
//
// Run from apps/mercurypitch:
//
//   pnpm shots                              # every device, every screen
//   pnpm shots --project iphone-6.9         # one device
//   pnpm shots -g sing                      # matching screens only
//
// Each screen is written as a PNG flattened to 8-bit RGB (store uploads
// reject alpha) to ~/agent-out/mercurypitch/<YYYY-MM-DD>/shots/<run>/<project>/,
// with a contact sheet, index.html, and manifest.json beside them.
// MERCURYPITCH_SHOTS_DIR overrides the folder. Nothing is written into the
// repository: the build goes to the OS temporary directory, and a failed
// shot leaves its trace in $TMPDIR/mercurypitch-shots-<port>/.
//
// This is a local tool and never runs in CI: pr-gate.yml runs only the root
// playwright.config.ts, whose testDir is ./src/e2e. A store screenshot is
// judged by eye, not gated. Same shape as apps/beside-cue's harness.

import type { PlaywrightTestOptions } from '@playwright/test'
import { defineConfig } from '@playwright/test'
import { createHash } from 'node:crypto'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const APP_ROOT = fileURLToPath(new URL('.', import.meta.url))

/** A device's safe-area insets in portrait, in CSS px. */
export interface SafeArea {
  readonly top: number
  readonly bottom: number
}

export interface ShotOptions {
  /** Folder that receives <project>/<nn-screen>.png. */
  readonly shotDir: string
  /**
   * Where the device's status bar and home indicator sit, which the app
   * keeps clear of through env(safe-area-inset-*). store.shots.ts answers
   * env() with these, as WebKit does on the device.
   */
  readonly safeArea: SafeArea
}

// A per-checkout port, so parallel worktrees never answer for each other.
function checkoutPort(): number {
  const digest = createHash('sha256').update(APP_ROOT).digest()
  return 5200 + (digest.readUInt16BE(0) % 400)
}

const configuredPort = process.env.MERCURYPITCH_SHOTS_PORT
const shotsPort =
  configuredPort === undefined || configuredPort === ''
    ? checkoutPort()
    : Number(configuredPort)

/** Where the shots build goes: outside the checkout, one folder per port. */
export const SHOTS_BUILD_DIR = join(
  tmpdir(),
  `mercurypitch-shots-build-${shotsPort}`,
)
process.env.MERCURYPITCH_SHOTS_BUILD_DIR = SHOTS_BUILD_DIR

/**
 * The fictional singer's voice: a WAV Chromium plays as its microphone. It
 * is written by shots/global-setup.ts, before any browser starts, from the
 * notes in shots/voice.ts. Outside the run's output folder, which Playwright
 * empties at the start of a run.
 */
export const VOICE_WAV = join(
  tmpdir(),
  `mercurypitch-shots-voice-${shotsPort}`,
  'phrase.wav',
)

function localDate(date: Date): string {
  return [
    String(date.getFullYear()).padStart(4, '0'),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

// Resolved once in the runner and inherited by the workers and the contact
// sheet, so a run that crosses midnight still writes one folder.
const shotDirFromEnv = process.env.MERCURYPITCH_SHOTS_DIR ?? ''
const shotDir =
  shotDirFromEnv !== ''
    ? shotDirFromEnv
    : join(
        homedir(),
        'agent-out',
        'mercurypitch',
        localDate(new Date()),
        'shots',
        new Date().toISOString().replaceAll(':', '-'),
      )
process.env.MERCURYPITCH_SHOTS_DIR = shotDir

// Touch viewports render the shared web UI through the native shell's own
// bundle. System bars and permission sheets are not drawn. The iPhone and
// iPad keep their safe-area insets, so the app lays out clear of where the
// status bar and home indicator would be; the Android captures are the web
// view's own area, with no insets. See shots/README.md.
const DEVICE: Partial<PlaywrightTestOptions> = {
  isMobile: true,
  hasTouch: true,
  colorScheme: 'dark',
  locale: 'en-US',
  timezoneId: 'UTC',
  permissions: ['microphone'],
  // Every request goes through the page, where the stand-in answers it.
  serviceWorkers: 'block',
  // A browser-context option with no `use` shortcut: a bare `reducedMotion`
  // key in `use` is silently ignored. store.shots.ts asserts it took.
  contextOptions: { reducedMotion: 'reduce' },
}

// The model Settings shows under "This phone" is what the phone reports
// through @capacitor/device, which the browser answers from the user agent.
// A desktop agent would put "X11" in a store screenshot.
const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1'
const IPAD_UA =
  'Mozilla/5.0 (iPad; CPU OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1'
const ANDROID_UA =
  'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Mobile Safari/537.36'
const ANDROID_TABLET_UA =
  'Mozilla/5.0 (Linux; Android 15; Pixel Tablet) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36'

export default defineConfig<ShotOptions>({
  testDir: './shots',
  testMatch: '*.shots.ts',
  // Out of the checkout: the app's `prettier --check .` would read
  // Playwright's own run files if they sat under apps/mercurypitch.
  outputDir: join(tmpdir(), `mercurypitch-shots-${shotsPort}`),
  globalSetup: './shots/global-setup.ts',
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
    launchOptions: {
      args: [
        // Headless by default; a `--headed` debugging run must still land
        // on the agents workspace, which keys on this class.
        '--class=agent-browser',
        '--use-fake-device-for-media-stream',
        '--use-fake-ui-for-media-stream',
        `--use-file-for-fake-audio-capture=${VOICE_WAV}`,
        '--autoplay-policy=no-user-gesture-required',
        '--mute-audio',
      ],
    },
  },
  projects: [
    {
      // 440 x 956 at 3x = 1320 x 2868, the App Store 6.9-inch iPhone size.
      name: 'iphone-6.9',
      use: {
        ...DEVICE,
        userAgent: IPHONE_UA,
        viewport: { width: 440, height: 956 },
        deviceScaleFactor: 3,
        // The status bar over the Dynamic Island, and the home indicator.
        safeArea: { top: 62, bottom: 34 },
      },
    },
    {
      // 1032 x 1376 at 2x = 2064 x 2752, the App Store 13-inch iPad size.
      // The app is built for iPad too (TARGETED_DEVICE_FAMILY 1,2), so
      // App Store Connect asks for this set.
      name: 'ipad-13',
      use: {
        ...DEVICE,
        userAgent: IPAD_UA,
        viewport: { width: 1032, height: 1376 },
        deviceScaleFactor: 2,
        // The iPad status bar, and the home indicator.
        safeArea: { top: 24, bottom: 20 },
      },
    },
    {
      // 390 x 780 at 2x = 780 x 1560: the phone screen that sits 1:1 inside
      // a 1080 x 1920 Google Play screenshot, with room above it for one
      // line. A 1:2 phone, so the app lays out as it does on a real one.
      name: 'play-phone',
      use: {
        ...DEVICE,
        userAgent: ANDROID_UA,
        viewport: { width: 390, height: 780 },
        deviceScaleFactor: 2,
      },
    },
    {
      // 612 x 1088 at 2x = 1224 x 2176: 9:16 with a short side over 1080,
      // what Google Play asks of a 7-inch tablet screenshot.
      name: 'play-tablet-7',
      use: {
        ...DEVICE,
        userAgent: ANDROID_TABLET_UA,
        viewport: { width: 612, height: 1088 },
        deviceScaleFactor: 2,
      },
    },
    {
      // 810 x 1440 at 2x = 1620 x 2880: 9:16, a 10-inch tablet screenshot.
      name: 'play-tablet-10',
      use: {
        ...DEVICE,
        userAgent: ANDROID_TABLET_UA,
        viewport: { width: 810, height: 1440 },
        deviceScaleFactor: 2,
      },
    },
  ],
  webServer: {
    command: `pnpm shots:serve --host 127.0.0.1 --port ${shotsPort} --strictPort`,
    cwd: APP_ROOT,
    url: `http://127.0.0.1:${shotsPort}`,
    // A fresh bundle is mandatory; never reuse a dev server or an old build.
    reuseExistingServer: false,
    env: { MERCURYPITCH_SHOTS_BUILD_DIR: SHOTS_BUILD_DIR },
    timeout: 240_000,
  },
})
