// Reproducible side views for validating authored flower contact and clearance.
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, expect } from '@playwright/test'

const here = dirname(fileURLToPath(import.meta.url))
const output = resolve(here, 'v10-vegetation-polish-orbits-r3')
const viewport = { width: 1600, height: 1000 }
const url = new URL(
  '/glass-game/?campaign=1',
  process.env.GLASS_QA_URL ?? 'http://127.0.0.1:5908',
)
if (!['127.0.0.1', 'localhost'].includes(url.hostname))
  throw new Error('Museum proofs must use a local development server.')
await mkdir(output, { recursive: true })

const views = [
  ['glassworks-isle', 'left', -320, 0],
  ['glassworks-isle', 'right', 320, 0],
  ['glassworks-isle', 'top', 0, 150],
  ['twin-galleries-isle', 'left', -320, 0],
  ['twin-galleries-isle', 'right', 320, 0],
  ['twin-galleries-isle', 'top', 0, 150],
  ['twin-galleries-isle', 'top-left', -260, 150],
  ['twin-galleries-isle', 'top-right', 260, 150],
  ['resonance-conservatory-isle', 'left', -320, 0],
  ['resonance-conservatory-isle', 'right', 320, 0],
  ['resonance-conservatory-isle', 'top', 0, 150],
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
const screenshots = []
try {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 })
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
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

  for (let viewIndex = 0; viewIndex < views.length; viewIndex++) {
    const [stage, side, dragX, dragY] = views[viewIndex]
    if (viewIndex > 0) {
      await page
        .getByRole('button', { name: 'Reset museum view', exact: true })
        .click()
      await page.waitForTimeout(900)
    }
    const label = page.locator(`[data-journey-label="${stage}"]`)
    await expect(label).toHaveAttribute('data-projected', 'true')
    const box = await canvas.boundingBox()
    if (!box) throw new Error('Canvas bounds unavailable.')
    await page.mouse.click(
      box.x + Number(await label.getAttribute('data-projected-x')),
      box.y + Number(await label.getAttribute('data-projected-y')),
    )
    await expect(frame).toHaveAttribute('data-selected-stage', stage)
    await page.waitForTimeout(900)
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.48)
    for (let step = 0; step < 4; step++) await page.mouse.wheel(0, -720)
    await expect(canvas).toHaveAttribute('data-journey-camera-zoom', '1.000')
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.45)
    await page.mouse.down()
    await page.mouse.move(
      box.x + box.width * 0.5 + dragX,
      box.y + box.height * 0.45 + dragY,
      { steps: 20 },
    )
    await page.mouse.up()
    await page.waitForTimeout(1000)
    const file = `${stage}-${side}.png`
    await canvas.screenshot({
      path: resolve(output, file),
      animations: 'disabled',
    })
    screenshots.push({
      file,
      stage,
      side,
      camera: {
        yaw: await canvas.getAttribute('data-journey-camera-yaw'),
        pitch: await canvas.getAttribute('data-journey-camera-pitch'),
        zoom: await canvas.getAttribute('data-journey-camera-zoom'),
      },
      sha256: createHash('sha256')
        .update(await readFile(resolve(output, file)))
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
  await writeFile(
    resolve(output, 'manifest.json'),
    `${JSON.stringify(
      {
        url: url.href,
        viewport,
        deviceScope: 'Desktop browser on local hardware',
        renderer,
        rasterization: 'actual WebGL drawing; no suppressed calls',
        purpose:
          'Side views supplement the matched desktop and tablet proofs; clearance assertions remain in vegetation.test.ts.',
        screenshots,
        errors,
      },
      null,
      2,
    )}\n`,
  )
  if (errors.length) process.exitCode = 1
} finally {
  await browser.close()
}
