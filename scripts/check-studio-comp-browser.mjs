// Studio comp browser check: a comped loop take exports as it plays, its joins step no further than its passes do, and songs with no comp render bit for bit as a baseline did, in real Chromium.
// Usage: pnpm dev (or any local Vite server), then
//   timeout 600s node scripts/check-studio-comp-browser.mjs --origin https://127.0.0.1:5173 [--out report.json] [--baseline before.json] [--no-comp]
// --no-comp runs only the songs with no comp, as a build without comping can;
// --baseline fails unless their hashes match that report's. Renders offline only: nothing plays aloud.
import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'
import console from 'node:console'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'
import { parseArgs } from 'node:util'

const { values } = parseArgs({
  options: {
    origin: { type: 'string', default: 'https://127.0.0.1:5173' },
    out: { type: 'string' },
    baseline: { type: 'string' },
    'no-comp': { type: 'boolean', default: false },
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
const baseline =
  values.baseline === undefined
    ? null
    : JSON.parse(readFileSync(resolve(values.baseline), 'utf8'))

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
    if (url.pathname === '/__studio_comp_check')
      return route.fulfill({
        contentType: 'text/html',
        body: '<!doctype html><title>Studio comp check</title>',
      })
    return route.continue()
  })
  await page.goto(`${origin}/__studio_comp_check`, { timeout: 30000 })
  const results = await page.evaluate(async (comp) => {
    const probes = await import('/scripts/studio-comp-browser-probes.mjs')
    return probes.runStudioCompProbes({ comp })
  }, !values['no-comp'])
  if (baseline !== null) {
    const before = baseline.results.uncompedHashes.hashes
    const after = results.uncompedHashes.hashes
    results.uncompedHashes.baseline = before
    results.uncompedHashes.pass = Object.keys(before).every(
      (name) => after[name] === before[name],
    )
  }
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
    'Studio comp probes failed',
  )
  console.log(`Studio comp browser check passed on ${report.browser}`)
} finally {
  await browser.close()
}
