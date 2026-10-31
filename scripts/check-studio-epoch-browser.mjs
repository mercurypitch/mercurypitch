// Studio epoch browser check: Plays asked for between two frames still start every source on a frame, in real Chromium.
// Usage: pnpm dev (or any local Vite server), then
//   timeout 300s node scripts/check-studio-epoch-browser.mjs --origin https://127.0.0.1:5173 [--out report.json]
// Set CHROME_PATH to use a specific Chromium build instead of Playwright's. Renders offline only: nothing plays aloud.
import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'
import console from 'node:console'
import { existsSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'
import { parseArgs } from 'node:util'

const { values } = parseArgs({
  options: {
    origin: { type: 'string', default: 'https://127.0.0.1:5173' },
    out: { type: 'string' },
  },
})
const origin = new URL(values.origin).origin
assert.ok(
  ['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin).hostname),
  'Only loopback servers are allowed',
)
const out = values.out === undefined ? null : resolve(values.out)
assert.ok(
  out === null || !existsSync(out),
  'Existing report must not be overwritten',
)

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH,
  args: ['--mute-audio'],
})
try {
  const context = await browser.newContext({ ignoreHTTPSErrors: true })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url())
    if (url.origin !== origin) return route.abort()
    if (url.pathname === '/__studio_epoch_check')
      return route.fulfill({
        contentType: 'text/html',
        body: '<!doctype html><title>Studio epoch check</title>',
      })
    return route.continue()
  })
  await page.goto(`${origin}/__studio_epoch_check`, { timeout: 30000 })
  const results = await page.evaluate(async () => {
    const probes = await import('/scripts/studio-epoch-browser-probes.mjs')
    return probes.runStudioEpochProbes()
  })
  const report = { browser: browser.version(), origin, errors, results }
  if (out !== null)
    writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' })
  for (const [name, result] of Object.entries(results))
    console.log(
      `${result.pass ? 'PASS' : 'FAIL'}  ${name}  ${JSON.stringify(result)}`,
    )
  assert.deepEqual(errors, [], 'Browser emitted errors')
  const failed = Object.entries(results).filter(([, result]) => !result.pass)
  assert.deepEqual(
    failed.map(([name]) => name),
    [],
    'Studio epoch probes failed',
  )
  console.log(`Studio epoch browser check passed on ${report.browser}`)
} finally {
  await browser.close()
}
