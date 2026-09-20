// Loading presentation inspection — actual host CSS and one fully installed WebGL frame.
import { chromium } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const output = fileURLToPath(new URL('.', import.meta.url))
const base = process.env.GLASS_PROOF_BASE || 'https://localhost:5187'
await mkdir(output, { recursive: true })
const browser = await chromium.launch({
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const records = []
try {
  for (const viewport of [
    { width: 1280, height: 800 },
    { width: 390, height: 740 },
    { width: 740, height: 390 },
  ]) {
    const context = await browser.newContext({
      viewport,
      hasTouch: true,
      ignoreHTTPSErrors: true,
      reducedMotion: 'reduce',
    })
    const page = await context.newPage()
    page.setDefaultTimeout(120_000)
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.addInitScript(() => {
      localStorage.setItem('beside-cue:glass-adventure:tutorial', 'seen')
      // Stop recurring frames only after the real installed scene is revealed.
      // This capture is visual evidence, not a throughput or gameplay benchmark.
      const schedule = window.requestAnimationFrame.bind(window)
      let revealed = false
      window.requestAnimationFrame = (callback) =>
        schedule((now) => {
          if (revealed) return
          callback(now)
          if (
            document.querySelector(
              '[data-testid="glass-adventure"][data-ready="true"]',
            )
          )
            revealed = true
        })
    })
    let release
    const held = new Promise((resolve) => {
      release = resolve
    })
    await page.route('**/games/glass3d/merc.glb', async (route) => {
      await held
      await route.continue()
    })
    await page.goto(`${base}/glass-game/?layout=tutorial`)
    const cover = page.getByTestId('glass-loading-screen')
    await cover.waitFor({ state: 'visible' })
    await cover.locator('img').evaluate((image) => image.decode())
    await cover
      .getByRole('button', { name: 'Leave museum' })
      .tap({ trial: true })
    const dimensions = await cover.evaluate((element) => ({
      width: element.clientWidth,
      scrollWidth: element.scrollWidth,
      height: element.clientHeight,
      scrollHeight: element.scrollHeight,
      reducedMotion: getComputedStyle(element.querySelector('img'))
        .animationName,
    }))
    if (
      dimensions.width !== viewport.width ||
      dimensions.height !== viewport.height
    )
      throw new Error(
        `The loading cover changed during inspection: ${JSON.stringify(dimensions)}`,
      )
    const stem = `${viewport.width}x${viewport.height}`
    await page.screenshot({ path: `${output}/${stem}-loading.png` })
    release()
    await page.waitForFunction(
      () =>
        document
          .querySelector('[data-testid="glass-adventure"]')
          ?.getAttribute('data-ready') === 'true',
      undefined,
      { polling: 100 },
    )
    await page
      .getByLabel('Floating glass museum')
      .evaluate((canvas) => canvas.getContext('webgl2').finish())
    await page.screenshot({ path: `${output}/${stem}-ready.png` })
    records.push({
      viewport,
      dimensions,
      errors,
      screenshots: [`${stem}-loading.png`, `${stem}-ready.png`],
    })
    await context.close()
  }
  for (const viewport of [
    { width: 390, height: 740 },
    { width: 740, height: 390 },
  ]) {
    const context = await browser.newContext({
      viewport,
      hasTouch: true,
      ignoreHTTPSErrors: true,
      reducedMotion: 'reduce',
    })
    const page = await context.newPage()
    await page.route('**/games/glass3d/merc.glb', (route) =>
      route.abort('failed'),
    )
    await page.goto(`${base}/glass-game/`)
    const cover = page.getByTestId('glass-loading-screen')
    await page.waitForFunction(
      () =>
        document
          .querySelector('[data-testid="glass-loading-screen"]')
          ?.getAttribute('data-phase') === 'error',
    )
    await cover.locator('img').evaluate((image) => image.decode())
    const retry = cover.getByRole('button', { name: 'Retry', exact: true })
    await retry.tap({ trial: true })
    const dimensions = await cover.evaluate((element) => ({
      width: element.clientWidth,
      scrollWidth: element.scrollWidth,
      height: element.clientHeight,
      scrollHeight: element.scrollHeight,
    }))
    const filename = `${viewport.width}x${viewport.height}-error.png`
    await page.screenshot({ path: `${output}/${filename}` })
    records.push({
      viewport,
      dimensions,
      errors: [],
      screenshots: [filename],
      expectedFailure:
        'Required Merc request aborted; Retry actionable by touch.',
    })
    await context.close()
  }
} finally {
  await browser.close()
}
await writeFile(
  `${output}/inspection.json`,
  `${JSON.stringify({ records, method: 'Actual Solid host; downloads held for cover capture; real WebGL frame rendered after all critical assets installed. RAF frozen after reveal for stable screenshots. Not a frame-rate measurement.' }, null, 2)}\n`,
)
if (records.some((record) => record.errors.length))
  throw new Error('Browser errors in inspection.json')
console.log(JSON.stringify(records))
