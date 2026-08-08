// Verify the opening backdrop (App.tsx "The opening") against a BUILT
// bundle — the lazy-chunk timing it exists for does not reproduce under
// the dev server's module graph.
//
//   pnpm build:tours && pnpm verify:opening
//
// Four scenarios, asserted, exit 1 on any violation:
//   fresh        first visit: backdrop (with art) covers the shell at
//                ~400ms, First Light revealed once it drops
//   returning    seen-flags set: backdrop at ~400ms, app revealed, no flow
//   fresh-mobile the same first visit at 390x844
//   automation   navigator.webdriver left true: the backdrop must never
//                render, so specs and tour walkers never wait behind it
//
// The three human scenarios spoof navigator.webdriver to false, exactly
// because the product gates the backdrop on it. Screenshots land in
// test-results/opening/ (gitignored).
import { chromium } from '@playwright/test'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, join } from 'node:path'

const DIST = process.argv[2] ?? './dist'
const OUT = process.argv[3] ?? './test-results/opening'
const PORT = Number(process.env.OPENING_PORT ?? 4199)
const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
  '.woff2': 'font/woff2',
}

if (!existsSync(join(DIST, 'index.html'))) {
  console.error(`No ${DIST}/index.html — run \`pnpm build:tours\` first.`)
  process.exit(1)
}

const server = createServer(async (req, res) => {
  const path = req.url.split('?')[0]
  const file = path === '/' ? '/index.html' : path
  try {
    const body = await readFile(join(DIST, file))
    res.writeHead(200, {
      'content-type': MIME[extname(file)] ?? 'application/octet-stream',
    })
    res.end(body)
  } catch {
    try {
      const body = await readFile(join(DIST, 'index.html'))
      res.writeHead(200, { 'content-type': 'text/html' })
      res.end(body)
    } catch {
      res.writeHead(404).end()
    }
  }
})
await new Promise((resolve) => server.listen(PORT, resolve))

const browser = await chromium.launch()
const results = {}
const OPENING = '[class*="appOpening"]'
const FLOW = '[data-onboarding-flow]:not([class*="appOpening"])'

async function scenario(name, { human, returning, mobile }) {
  const ctx = await browser.newContext({
    viewport: mobile
      ? { width: 390, height: 844 }
      : { width: 1280, height: 800 },
    deviceScaleFactor: 1,
  })
  if (human) {
    await ctx.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false })
    })
  }
  if (returning) {
    await ctx.addInitScript(() => {
      localStorage.setItem('pitchperfect_onboarding_done', '1')
      localStorage.setItem('pitchperfect_welcome_version', '0.8.0')
    })
  }
  const page = await ctx.newPage()
  const t0 = Date.now()
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'commit' })
  // Inside the 750ms minimum hold, with slack for boot.
  await page.waitForTimeout(Math.max(0, 420 - (Date.now() - t0)))
  const during = await page.evaluate(
    ([o, f]) => ({
      opening: !!document.querySelector(o),
      artReady: !!document.querySelector('img[class*="appOpeningArt"]')
        ?.complete,
      flow: !!document.querySelector(f),
      nav: !!document.querySelector('nav, [class*="sidebar" i]'),
    }),
    [OPENING, FLOW],
  )
  await page.screenshot({ path: `${OUT}/${name}-during.png` })
  // Past hold (750ms) + fade (400ms), with slack.
  await page.waitForTimeout(1400)
  const after = await page.evaluate(
    ([o, f]) => ({
      opening: !!document.querySelector(o),
      flow: !!document.querySelector(f),
      nav: !!document.querySelector('nav, [class*="sidebar" i]'),
    }),
    [OPENING, FLOW],
  )
  await page.screenshot({ path: `${OUT}/${name}-after.png` })
  results[name] = { during, after }
  await ctx.close()
}

await scenario('fresh', { human: true })
await scenario('returning', { human: true, returning: true })
await scenario('fresh-mobile', { human: true, mobile: true })
await scenario('automation', { human: false })

await browser.close()
server.close()

const failures = []
const expect = (cond, label) => {
  if (!cond) failures.push(label)
}
for (const name of ['fresh', 'fresh-mobile']) {
  expect(results[name].during.opening, `${name}: backdrop up during hold`)
  expect(results[name].during.artReady, `${name}: art loaded during hold`)
  expect(!results[name].after.opening, `${name}: backdrop gone after hold`)
  expect(results[name].after.flow, `${name}: First Light revealed`)
}
expect(results.returning.during.opening, 'returning: backdrop up during hold')
expect(!results.returning.after.opening, 'returning: backdrop gone after hold')
expect(!results.returning.after.flow, 'returning: no flow for a seen visitor')
expect(results.returning.after.nav, 'returning: app chrome revealed')
expect(!results.automation.during.opening, 'automation: no backdrop, ever')
expect(
  !results.automation.after.opening,
  'automation: no backdrop, ever (late)',
)
expect(results.automation.after.flow, 'automation: flow mounts directly')

console.log(JSON.stringify(results, null, 1))
if (failures.length > 0) {
  console.error(`\nFAIL:\n- ${failures.join('\n- ')}`)
  process.exit(1)
}
console.log('\nOK: opening backdrop behaves in all four scenarios.')
