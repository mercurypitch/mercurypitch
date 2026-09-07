// Guitar amp browser gate records real DSP parity, interpolation and silent live-transition evidence.
// Usage: timeout 120s node scripts/check-guitar-amp-browser.mjs --origin http://127.0.0.1:5217 --out <new-report.json>
import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'
import console from 'node:console'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { clearTimeout, setTimeout } from 'node:timers'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

const { values } = parseArgs({
  options: {
    origin: { type: 'string', default: 'http://127.0.0.1:5217' },
    out: { type: 'string' },
  },
})
assert.ok(
  typeof values.out === 'string' && values.out.length > 0,
  'Supply --out pointing to a new report',
)
const origin = new URL(values.origin).origin
assert.ok(
  ['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin).hostname),
  'Only loopback servers are allowed',
)
const out = resolve(values.out)
assert.equal(
  existsSync(out),
  false,
  'Existing browser evidence must not be overwritten',
)
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const hash = (path) =>
  createHash('sha256')
    .update(readFileSync(resolve(root, path)))
    .digest('hex')
const report = {
  schemaVersion: 2,
  createdAt: new Date().toISOString(),
  origin,
  sourceHashes: Object.fromEntries(
    [
      'src/lib/guitar/guitar-studio-head.ts',
      'src/lib/guitar/guitar-studio-processor.ts',
      'src/lib/guitar/guitar-amp-stage.ts',
      'src/lib/guitar/guitar-amp-cabinet.ts',
      'src/lib/guitar/guitar-electric-amp.ts',
      'src/assets/audio/guitar/cookie-monster.wav',
      'scripts/guitar-audition-head.mjs',
      'scripts/guitar-amp-browser-probes.mjs',
      'scripts/check-guitar-amp-browser.mjs',
    ].map((path) => [path, hash(path)]),
  ),
  method:
    'Identical deterministic overlapping picked-chord source; neutral Studio controls (drive0.7/output0.6/EQ0). Full hash-verified IR, normalize=false, -18dB trim. CPU values are single offline render timings, not device audio-thread budgets or performance acceptance claims.',
}
let browser
let timer
try {
  browser = await chromium.launch({
    headless: true,
    args: ['--autoplay-policy=no-user-gesture-required'],
  })
  report.browserVersion = browser.version()
  const page = await browser.newPage()
  const errors = []
  const blocked = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url())
    if (url.origin !== origin) {
      blocked.push(url.origin)
      return route.abort()
    }
    if (url.pathname === '/__guitar_amp_check')
      return route.fulfill({
        contentType: 'text/html',
        body: '<!doctype html><title>Local guitar DSP verification</title>',
      })
    return route.continue()
  })
  await page.goto(`${origin}/__guitar_amp_check`, { timeout: 15000 })
  const probes = (async () => {
    report.offline = await page.evaluate(async () => {
      const helper = await import('/scripts/guitar-amp-browser-probes.mjs')
      return helper.verifyOffline()
    })
    report.live = []
    for (const scenario of ['steady', 'single', 'rapid', 'rapid'])
      report.live.push(
        await page.evaluate(async (selectedScenario) => {
          const helper = await import('/scripts/guitar-amp-browser-probes.mjs')
          return helper.verifyLiveTransitions(selectedScenario)
        }, scenario),
      )
  })()
  await Promise.race([
    probes,
    new Promise((_resolve, reject) => {
      timer = setTimeout(
        () => reject(new Error('Browser DSP gate exceeded105-second deadline')),
        105000,
      )
    }),
  ])
  assert.deepEqual(errors, [], 'Browser emitted errors')
  assert.deepEqual(blocked, [], 'Probe attempted a non-local request')
  report.browserErrors = errors
  report.nonLocalRequests = blocked
  assert.ok(
    report.live.every((entry) => entry.referenceContinuous === true) === true,
    'Raw reference was discontinuous; live capture cannot establish DSP continuity',
  )
  assert.ok(
    report.live.every((entry) => entry.transientWithinBound === true) === true,
    'Live transition produced an excessive transient; inspect report.live',
  )
  for (const [path, before] of Object.entries(report.sourceHashes))
    assert.equal(
      hash(path),
      before,
      `Source changed during DSP verification: ${path}`,
    )
  report.passed = true
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' })
  console.log(`Guitar browser DSP gate passed: ${out}`)
} catch (error) {
  report.passed = false
  report.error = error instanceof Error ? error.message : String(error)
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' })
  throw error
} finally {
  if (timer !== undefined) clearTimeout(timer)
  await browser?.close()
}
