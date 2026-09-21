// Real compiled loader proofs; software rendering verifies pixels, not device performance.
import { chromium, expect } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const base = process.env.GLASS_PROOF_BASE ?? 'https://localhost:5296'
if (
  !['localhost', '127.0.0.1', '192.168.178.33'].includes(new URL(base).hostname)
)
  throw new Error('Loader proofs require a local preview.')
const output = new URL('./runtime/', import.meta.url)
await mkdir(output, { recursive: true })
const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const records = []
try {
  for (const scenario of [
    { name: 'desktop', width: 1280, height: 800 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'phone', width: 390, height: 740 },
    { name: 'short-landscape', width: 740, height: 390 },
    { name: 'reduced-motion', width: 390, height: 740, still: true },
    { name: 'error', width: 320, height: 568, failure: true },
  ]) {
    const context = await browser.newContext({
      viewport: { width: scenario.width, height: scenario.height },
      ignoreHTTPSErrors: true,
      hasTouch: true,
      reducedMotion: scenario.still ? 'reduce' : 'no-preference',
    })
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    let release
    const held = new Promise((resolve) => {
      release = resolve
    })
    await page.route(
      '**/games/adventure-v2/textures/warm-carrara-normal.png',
      async (route) => {
        if (scenario.failure) return route.abort('failed')
        await held
        await route.abort('aborted').catch(() => undefined)
      },
    )
    try {
      await page.goto(`${base}/glass-game/`, { waitUntil: 'domcontentloaded' })
      const cover = page.getByTestId('glass-loading-screen')
      await expect(cover).toBeVisible()
      if (scenario.failure)
        await expect(cover).toHaveAttribute('data-phase', 'error', {
          timeout: 30000,
        })
      await expect(cover.getByTestId('glass-loading-merc')).toHaveAttribute(
        'data-ready',
        'true',
        { timeout: 30000 },
      )
      const action = cover.getByRole('button', {
        name: scenario.failure ? 'Retry' : 'Leave museum',
        exact: true,
      })
      await action.tap({ trial: true })
      const appearance = await cover.evaluate((element) => {
        const canvas = element.querySelector('canvas')
        const progress = element.querySelector('[role="progressbar"]')
        const button = element.querySelector('button')
        const bounds = canvas.getBoundingClientRect()
        return {
          width: element.clientWidth,
          scrollWidth: element.scrollWidth,
          canvas: {
            top: bounds.top,
            bottom: bounds.bottom,
            width: bounds.width,
            height: bounds.height,
            opacity: getComputedStyle(canvas).opacity,
          },
          progress: {
            now: progress.getAttribute('aria-valuenow'),
            max: progress.getAttribute('aria-valuemax'),
            width: progress.clientWidth,
            fill: getComputedStyle(progress.firstElementChild).transform,
          },
          button: {
            height: button.getBoundingClientRect().height,
            font: getComputedStyle(button).fontFamily,
          },
        }
      })
      if (
        appearance.width !== appearance.scrollWidth ||
        appearance.canvas.top < 0 ||
        appearance.canvas.bottom > scenario.height ||
        appearance.canvas.width < 100 ||
        appearance.canvas.opacity !== '1' ||
        appearance.button.height < 44
      )
        throw new Error(
          `Loader layout regression: ${JSON.stringify(appearance)}`,
        )
      const filename = `${scenario.name}.png`
      await page.screenshot({
        path: fileURLToPath(new URL(filename, output)),
        timeout: 90000,
      })
      records.push({ ...scenario, appearance, errors, filename })
      await writeFile(
        new URL('manifest.json', output),
        JSON.stringify(
          {
            capturedAt: new Date().toISOString(),
            base,
            evidence:
              'Actual compiled app and actual 3D Merc under SwiftShader. Required texture deliberately held; no draw calls stubbed. Not physical-device performance acceptance.',
            records,
          },
          null,
          2,
        ) + '\n',
      )
    } finally {
      release()
      await context.close()
    }
  }
} finally {
  await browser.close()
}
if (records.some((record) => record.errors.length))
  throw new Error('Loader browser errors')
console.log(JSON.stringify(records))
