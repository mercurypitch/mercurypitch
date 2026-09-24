// Capture the live floating museum in its actual host, with software-renderer limits explicit.
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const url = process.env.JOURNEY_PROOF_URL ?? 'http://127.0.0.1:5224/glass-game'
const output = new URL('../proofs/runtime/', import.meta.url)
await mkdir(output, { recursive: true })
const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const proofs = []
try {
  for (const [name, width, height, touch] of [
    ['desktop', 1440, 1000, false],
    ['tablet', 1024, 768, true],
    ['phone', 320, 640, true],
  ]) {
    const context = await browser.newContext({
      viewport: { width, height },
      hasTouch: touch,
      ignoreHTTPSErrors: true,
    })
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text())
    })
    await page.goto(url, { waitUntil: 'domcontentloaded' })
    await page.locator('[data-map-state="ready"]').waitFor({ timeout: 60_000 })
    await page.evaluate(() => document.fonts.ready)
    await page.waitForFunction(() => {
      const canvas = document.querySelector('[data-renderer-metrics]')
      const metrics = JSON.parse(
        canvas?.getAttribute('data-renderer-metrics') ?? 'null',
      )
      return metrics !== null && metrics.triangles > 99_000
    })
    const canvas = page.locator('[data-map-state] canvas')
    const metrics = JSON.parse(
      await canvas.getAttribute('data-renderer-metrics'),
    )
    const renderer = await canvas.evaluate((element) => {
      const gl = element.getContext('webgl2') ?? element.getContext('webgl')
      const info = gl?.getExtension('WEBGL_debug_renderer_info')
      return info === undefined || info === null
        ? 'unavailable'
        : gl.getParameter(info.UNMASKED_RENDERER_WEBGL)
    })
    const screenshot = new URL(`${name}.png`, output)
    await page.screenshot({
      path: fileURLToPath(screenshot),
      animations: 'disabled',
    })
    const bytes = await readFile(screenshot)
    proofs.push({
      name,
      viewport: { width, height },
      touch,
      renderer,
      metrics,
      errors,
      screenshot: `${name}.png`,
      bytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    })
    await context.close()
  }
} finally {
  await browser.close()
}
await writeFile(
  new URL('manifest.json', output),
  `${JSON.stringify(
    {
      createdAt: new Date().toISOString(),
      url,
      evidence:
        'Actual shared campaign render; SwiftShader software rendering, not physical-device FPS or thermal acceptance. Counts include shadow passes.',
      proofs,
    },
    null,
    2,
  )}\n`,
)
if (proofs.some((proof) => proof.errors.length > 0))
  throw new Error('Runtime proof contained browser errors.')
console.log(
  JSON.stringify(
    proofs.map(({ name, metrics, errors }) => ({ name, metrics, errors })),
  ),
)
