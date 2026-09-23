// Reproducible live museum comparisons: real rasterization, loaded-asset hashes and fixed views.
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, expect } from '@playwright/test'

const here = dirname(fileURLToPath(import.meta.url))
const repo = resolve(here, '../../../..')
const label = process.argv[2] ?? 'baseline'
if (!/^[a-z0-9-]+$/u.test(label)) throw new Error('Use a simple capture label.')
const output = resolve(here, label)
const tabletViewport = process.env.GLASS_QA_VIEWPORT === 'tablet'
const viewport = tabletViewport
  ? { width: 1024, height: 768 }
  : { width: 1600, height: 1000 }
await mkdir(output, { recursive: true })
const url = new URL(
  '/glass-game/?campaign=1',
  process.env.GLASS_QA_URL ?? 'http://127.0.0.1:5341',
)
if (!['127.0.0.1', 'localhost'].includes(url.hostname))
  throw new Error('Museum proofs must use a local development server.')
const browser = await chromium.launch({
  headless: true,
  args: [
    '--enable-gpu',
    '--ignore-gpu-blocklist',
    '--use-angle=vulkan',
    '--enable-features=Vulkan',
  ],
})
const errors = []
const assetWork = []
const screenshots = []
try {
  const page = await browser.newPage({
    viewport,
    deviceScaleFactor: 1,
  })
  const network = await page.context().newCDPSession(page)
  // The reviewed GLBs exceed Chromium's default per-response inspector buffer.
  await network.send('Network.enable', {
    maxTotalBufferSize: 256 * 1024 * 1024,
    maxResourceBufferSize: 128 * 1024 * 1024,
  })
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  const assetResponses = new Map()
  network.on('Network.responseReceived', ({ requestId, response }) => {
    const path = new URL(response.url).pathname
    if (!path.startsWith('/games/') || !path.endsWith('.glb')) return
    assetResponses.set(requestId, { path, response })
  })
  network.on('Network.loadingFinished', ({ requestId }) => {
    const asset = assetResponses.get(requestId)
    if (!asset) return
    assetResponses.delete(requestId)
    const { path, response } = asset
    // Read through the same CDP session whose response buffers we enlarged.
    assetWork.push(
      (async () => {
        const captured = await network.send('Network.getResponseBody', {
          requestId,
        })
        const body = Buffer.from(
          captured.body,
          captured.base64Encoded ? 'base64' : 'utf8',
        )
        const local = await readFile(
          resolve(repo, 'apps/beside-cue/public', path.slice(1)),
        )
        const hash = createHash('sha256').update(body).digest('hex')
        if (!body.equals(local) || response.status !== 200)
          throw new Error(`Served asset differs: ${path}`)
        return {
          url: response.url,
          file: `apps/beside-cue/public${path}`,
          status: response.status,
          capture: 'CDP response body from the actual application request',
          bytes: body.length,
          sha256: hash,
        }
      })().catch((error) => {
        errors.push(`Asset verification failed for ${path}: ${error.message}`)
        return { file: path, error: error.message }
      }),
    )
  })
  await page.goto(url.href, { waitUntil: 'domcontentloaded' })
  const frame = page.locator('[data-map-state]')
  await expect(frame).toHaveAttribute('data-map-state', 'ready', {
    timeout: 90_000,
  })
  const canvas = frame.locator('canvas')
  await expect
    .poll(
      async () =>
        JSON.parse((await canvas.getAttribute('data-renderer-metrics')) ?? '{}')
          .triangles,
      { timeout: 30_000 },
    )
    .toBeGreaterThan(200_000)
  for (const stage of ['twin-galleries-isle', 'resonance-conservatory-isle']) {
    if (screenshots.length > 0) {
      await page
        .getByRole('button', { name: 'Reset museum view', exact: true })
        .click()
      await page.waitForTimeout(1200)
    }
    const islandLabel = page.locator(`[data-journey-label="${stage}"]`)
    await expect(islandLabel).toHaveAttribute('data-projected', 'true')
    const box = await canvas.boundingBox()
    if (!box) throw new Error('Canvas bounds unavailable.')
    await page.mouse.click(
      box.x + Number(await islandLabel.getAttribute('data-projected-x')),
      box.y + Number(await islandLabel.getAttribute('data-projected-y')),
    )
    await expect(frame).toHaveAttribute('data-selected-stage', stage)
    await page.waitForTimeout(1200)
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.48)
    for (let step = 0; step < 4; step++) await page.mouse.wheel(0, -720)
    await expect(canvas).toHaveAttribute('data-journey-camera-zoom', '1.000')
    await page.waitForTimeout(1200)
    const frameCadence = await page.evaluate(async () => {
      const intervals = []
      let previous = await new Promise(requestAnimationFrame)
      for (let frame = 0; frame < 120; frame++) {
        const next = await new Promise(requestAnimationFrame)
        intervals.push(next - previous)
        previous = next
      }
      intervals.sort((a, b) => a - b)
      return {
        method:
          '120 requestAnimationFrame intervals; desktop browser cadence, not GPU timings or tablet performance',
        medianMs: intervals[60],
        p95Ms: intervals[114],
        maximumMs: intervals[119],
      }
    })
    const file = `${stage}.png`
    await canvas.screenshot({
      path: resolve(output, file),
      animations: 'disabled',
    })
    screenshots.push({
      file,
      stage,
      camera: {
        yaw: await canvas.getAttribute('data-journey-camera-yaw'),
        pitch: await canvas.getAttribute('data-journey-camera-pitch'),
        zoom: await canvas.getAttribute('data-journey-camera-zoom'),
      },
      sha256: createHash('sha256')
        .update(await readFile(resolve(output, file)))
        .digest('hex'),
      rendererMetrics: JSON.parse(
        await canvas.getAttribute('data-renderer-metrics'),
      ),
      frameCadence,
    })
  }
  const renderer = await canvas.evaluate((element) => {
    const gl = element.getContext('webgl2')
    const debug = gl?.getExtension('WEBGL_debug_renderer_info')
    return debug
      ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)
      : 'unavailable'
  })
  const assets = await Promise.all(assetWork)
  const report = {
    url: url.href,
    viewport,
    deviceScope: tabletViewport
      ? 'Tablet-sized desktop browser; not a physical tablet benchmark'
      : 'Desktop browser on local hardware',
    renderer,
    rasterization: 'actual WebGL drawing; no suppressed calls',
    assets,
    screenshots,
    errors,
  }
  await writeFile(
    resolve(output, 'manifest.json'),
    `${JSON.stringify(report, null, 2)}\n`,
  )
  console.log(
    JSON.stringify({
      output,
      renderer,
      screenshots: screenshots.length,
      errors,
    }),
  )
  if (errors.length) process.exitCode = 1
} finally {
  await browser.close()
}
