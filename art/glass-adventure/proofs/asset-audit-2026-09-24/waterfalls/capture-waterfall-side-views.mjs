// Capture each authored waterfall from a useful side angle in the live museum renderer.
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, expect } from '@playwright/test'

const here = dirname(fileURLToPath(import.meta.url))
const repo = resolve(here, '../../../../..')
const viewport = { width: 1000, height: 1200 }
const url = new URL(
  '/glass-game/?campaign=1',
  process.env.GLASS_QA_URL ?? 'http://127.0.0.1:5908',
)
if (!['127.0.0.1', 'localhost'].includes(url.hostname))
  throw new Error('Waterfall proofs must use a local development server.')
await mkdir(here, { recursive: true })

const panels = [
  {
    waterfall: 'glassworks-falls',
    selectedStage: 'first-light-isle',
    zoom: 0.2,
    yaw: -0.58,
    pitch: 0.64,
    framing:
      'Shared First Light landmass focus keeps the Glassworks source pond and complete lower fade in frame.',
  },
  {
    waterfall: 'twin-falls',
    selectedStage: 'twin-galleries-isle',
    zoom: 0,
    yaw: 0.08,
    pitch: 0.58,
    framing:
      'The wider stage overview contains the full Twin curtain and particle dissolve.',
  },
  {
    waterfall: 'conservatory-east-falls',
    selectedStage: 'resonance-conservatory-isle',
    zoom: 0.2,
    yaw: 0.318,
    pitch: 0.64,
    framing:
      'The eastward side view exposes the conservatory pond, lip, curtain, and particle dissolve.',
  },
]

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
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 })
  const network = await page.context().newCDPSession(page)
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
        if (!body.equals(local) || response.status !== 200)
          throw new Error(`Served asset differs: ${path}`)
        return {
          url: response.url,
          file: `apps/beside-cue/public${path}`,
          status: response.status,
          bytes: body.length,
          sha256: createHash('sha256').update(body).digest('hex'),
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

  for (let panelIndex = 0; panelIndex < panels.length; panelIndex++) {
    const panel = panels[panelIndex]
    if (panelIndex > 0) {
      await page
        .getByRole('button', { name: 'Reset museum view', exact: true })
        .click()
      await page.waitForTimeout(600)
    }
    const label = page.locator(`[data-journey-label="${panel.selectedStage}"]`)
    await expect(label).toHaveAttribute('data-projected', 'true')
    const box = await canvas.boundingBox()
    if (!box) throw new Error('Canvas bounds unavailable.')
    await page.mouse.click(
      box.x + Number(await label.getAttribute('data-projected-x')),
      box.y + Number(await label.getAttribute('data-projected-y')),
    )
    await expect(frame).toHaveAttribute(
      'data-selected-stage',
      panel.selectedStage,
    )
    await page.waitForTimeout(600)

    const centerX = box.x + box.width * 0.5
    const centerY = box.y + box.height * 0.45
    let remainingZoom = panel.zoom
    await page.mouse.move(centerX, centerY)
    while (remainingZoom > 0.0001) {
      const step = Math.min(240 / 700, remainingZoom)
      await page.mouse.wheel(0, -step * 700)
      remainingZoom -= step
    }
    const yaw = Number(await canvas.getAttribute('data-journey-camera-yaw'))
    const pitch = Number(await canvas.getAttribute('data-journey-camera-pitch'))
    await page.mouse.move(centerX, centerY)
    await page.mouse.down()
    await page.mouse.move(
      centerX + (yaw - panel.yaw) / 0.004,
      centerY + (panel.pitch - pitch) / 0.0035,
      { steps: 20 },
    )
    await page.mouse.up()
    await expect(canvas).toHaveAttribute(
      'data-journey-camera-zoom',
      panel.zoom.toFixed(3),
    )
    await expect(canvas).toHaveAttribute(
      'data-journey-camera-yaw',
      panel.yaw.toFixed(3),
    )
    await expect(canvas).toHaveAttribute(
      'data-journey-camera-pitch',
      panel.pitch.toFixed(3),
    )
    await page.waitForTimeout(1_200)

    const proofStyle = await page.addStyleTag({
      content:
        '[data-map-state] > :not(:first-child), section[aria-label="Floating museum map"] > :not(:first-child) { display: none !important; }',
    })
    const file = `${panel.waterfall}.png`
    await canvas.screenshot({
      path: resolve(here, file),
      animations: 'disabled',
    })
    await proofStyle.evaluate((element) => element.remove())
    screenshots.push({
      file,
      waterfall: panel.waterfall,
      selectedStage: panel.selectedStage,
      framing: panel.framing,
      camera: {
        yaw: await canvas.getAttribute('data-journey-camera-yaw'),
        pitch: await canvas.getAttribute('data-journey-camera-pitch'),
        zoom: await canvas.getAttribute('data-journey-camera-zoom'),
      },
      sha256: createHash('sha256')
        .update(await readFile(resolve(here, file)))
        .digest('hex'),
      rendererMetrics: JSON.parse(
        (await canvas.getAttribute('data-renderer-metrics')) ?? '{}',
      ),
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
  const receipt = {
    url: url.href,
    viewport,
    deviceScope:
      'Portrait-sized desktop Chromium capture; visual evidence only, not a physical-device performance profile.',
    renderer,
    rasterization:
      'Actual WebGL drawing with the live museum geometry; only overlapping HTML controls are hidden during each canvas screenshot.',
    assets,
    screenshots,
    errors,
  }
  await writeFile(
    resolve(here, 'receipt.json'),
    `${JSON.stringify(receipt, null, 2)}\n`,
  )
  console.log(
    JSON.stringify({
      output: here,
      renderer,
      screenshots: screenshots.length,
      assets: assets.length,
      errors,
    }),
  )
  if (
    screenshots.length !== panels.length ||
    renderer === 'unavailable' ||
    errors.length
  )
    process.exitCode = 1
} finally {
  await browser.close()
}
