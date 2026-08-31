import { defineConfig, devices } from '@playwright/test'
import { createHash } from 'node:crypto'
import { cpus } from 'node:os'
import { loadEnv } from 'vite'

// Use Vite's built-in loadEnv to parse .env and .env.local without needing the dotenv package
const env = loadEnv('', process.cwd(), '')
Object.assign(process.env, env)

function numericEnv(value: string | undefined, fallback: number): number {
  return value === undefined || value === '' ? fallback : Number(value)
}

// The default port is derived from this checkout's path rather than fixed.
//
// `reuseExistingServer` below cannot tell one worktree's `serve dist` from
// another's — it only asks whether the port answers. On a machine running
// several checkouts at once (parallel agents, a worktree per branch), a
// leftover server from a *different* tree therefore answers first and the
// whole suite silently tests someone else's bundle. Measured 2026-08-31: a
// stale `serve` from a sibling worktree produced 71 failures across specs the
// branch had never touched, every one of them a directory listing where the
// app should have been. Re-run on a private port: 2 failures, both unrelated
// flakes.
//
// A per-checkout port makes that class of result impossible — the only server
// this run can reuse is the one this directory started. VITE_E2E_PORT still
// wins for anyone who wants a fixed one, and CI is a fresh container where
// every port is free.
function checkoutPort(): number {
  const digest = createHash('sha256').update(process.cwd()).digest()
  return 3100 + (digest.readUInt16BE(0) % 400)
}

const e2ePort = numericEnv(process.env.VITE_E2E_PORT, checkoutPort())

// A quarter of the cores locally, not Playwright's default half.
//
// That default is decided per run and blind to every other run on the box, so
// two or three checkouts testing at once ask for more CPU than exists. The
// specs that notice first are the ones with real deadlines in them — mic
// capture, decode, animation — and they fail on contention, not on code.
// Measured 2026-08-31 on a 24-core box: the same commit that CI passed on all
// four shards produced 29 local failures at half-cores, spread across specs the
// branch never touched (console-error guards, IndexedDB seeding, pointer
// drags). Every one of them passed when re-run alone.
//
// Half a machine per run is the wrong default where runs are concurrent, and a
// re-run to tell contention from a regression costs more than the parallelism
// saves. VITE_E2E_WORKERS raises it again for anyone testing alone. CI runners
// are not shared, so they keep their four.
function localWorkers(): number {
  const configured = process.env.VITE_E2E_WORKERS
  if (configured !== undefined && configured !== '') return Number(configured)
  return Math.max(2, Math.floor(cpus().length / 4))
}

export default defineConfig({
  testDir: './src/e2e',
  fullyParallel: true,
  forbidOnly: process.env.CI !== undefined,
  retries: process.env.CI !== undefined ? 2 : 0,
  workers: process.env.CI !== undefined ? 4 : localWorkers(),
  reporter: 'html',
  timeout: numericEnv(process.env.VITE_E2E_TIMEOUT, 30000),
  expect: {
    timeout: numericEnv(process.env.VITE_E2E_EXPECT_TIMEOUT, 5000),
  },
  use: {
    // Use production build served on this checkout's e2e port.
    baseURL: `http://localhost:${e2ePort}`,
    trace: 'on-first-retry',
    // Pinned so a developer's clock cannot change the app under test.
    // `isEeaTimezone` in src/lib/consent.ts shows the consent banner for
    // `Europe/*`, and the banner is anchored to the bottom of the viewport: on
    // a machine set to Europe/Zagreb it sits over the transport bar, so a
    // `mouse.down()` aimed at a control there lands on its Decline button
    // instead. Nothing errors — the locator resolves, the click "succeeds",
    // and an unrelated assertion fails on an unchanged value. CI runs UTC and
    // never saw it, which made it look like a branch regression twice.
    //
    // No spec asserts the banner today; one that wants it should ask for an
    // EEA clock itself with `test.use({ timezoneId: 'Europe/Zagreb' })`.
    timezoneId: 'UTC',
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
    // No `--single`: the app ships a document per room, not one SPA shell —
    // see `build.rollupOptions.input` in vite.config.ts for the current list,
    // and note `dist` emits more still (karaoke-night, jam-rooms). Specs reach
    // them extensionlessly (`goto('/piano-night')`), which plain `serve`
    // resolves; SPA-rewriting everything to index.html would break every entry
    // but the first.
    command: `pnpm exec serve dist -l ${e2ePort}`,
    url: `http://localhost:${e2ePort}`,
    reuseExistingServer: true,
    timeout: numericEnv(process.env.VITE_E2E_WEBSERVER_TIMEOUT, 120000),
  },
})
