// Capture matched per-island contact and inter-island stair views from the real runtime.
import { chromium, expect } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
const here = dirname(fileURLToPath(import.meta.url))
const phase = process.argv[2] ?? 'before'
if (!['before', 'after', 'inspect'].includes(phase))
  throw new Error('Unknown proof phase')
const out = resolve(here, phase)
await mkdir(out, { recursive: true })
const url = new URL(
  '/glass-game/?campaign=1',
  process.env.GLASS_QA_URL ?? 'http://127.0.0.1:5613',
)
if (!['localhost', '127.0.0.1'].includes(url.hostname))
  throw new Error('Local proof only')
const browser = await chromium.launch({
  args: [
    '--enable-gpu',
    '--ignore-gpu-blocklist',
    '--use-angle=vulkan',
    '--enable-features=Vulkan',
  ],
})
const panels = [
  {
    id: 'first-light-isle',
    title: 'First Light Gallery',
    file: 'first-light',
    zoom: 0.8,
    yaw: -0.62,
    pitch: 0.81,
  },
  {
    id: 'glassworks-isle',
    title: 'Glassworks Journey',
    file: 'glassworks',
    zoom: 0.65,
    yaw: 0.1,
    pitch: 0.77,
  },
  {
    id: 'twin-galleries-isle',
    title: 'Twin Galleries',
    file: 'twin-galleries',
    zoom: 0.83,
    yaw: 0.27,
    pitch: 0.83,
  },
  {
    id: 'resonance-conservatory-isle',
    title: 'Resonance Conservatory',
    file: 'conservatory',
    zoom: 0.83,
    yaw: 0.62,
    pitch: 0.83,
  },
  {
    id: 'twin-galleries-isle',
    title: 'Twin Galleries',
    file: 'bridge-connections',
    zoom: 0.42,
    yaw: 0.06,
    pitch: 0.71,
  },
]
const errors = []
const proofs = []
try {
  const page = await browser.newPage({
    viewport: { width: 1500, height: 1000 },
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
  })
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  await page.goto(url.href, { waitUntil: 'domcontentloaded' })
  const frame = page.locator('[data-map-state]')
  const canvas = frame.locator('canvas')
  await expect(frame).toHaveAttribute('data-map-state', 'ready', {
    timeout: 120000,
  })
  await page.waitForTimeout(700)
  await page.screenshot({ path: resolve(out, 'overview.png'), timeout: 90000 })
  const renderer = await canvas.evaluate((e) => {
    const gl = e.getContext('webgl2')
    const d = gl?.getExtension('WEBGL_debug_renderer_info')
    return d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'unavailable'
  })
  for (const panel of panels) {
    const reset = page.getByRole('button', {
      name: 'Reset museum view',
      exact: true,
    })
    if (await reset.isVisible()) await reset.click()
    await page
      .getByRole('navigation', { name: 'Select a museum island' })
      .getByRole('button', {
        name: `Select ${panel.title} on the museum map`,
        exact: true,
      })
      .click()
    await expect(frame).toHaveAttribute('data-selected-stage', panel.id)
    const box = await canvas.boundingBox()
    if (!box) throw new Error('Canvas missing')
    const x = box.x + box.width * 0.5,
      y = box.y + box.height * 0.4
    await page.mouse.move(x, y)
    let zoom = panel.zoom
    while (zoom > 0.0001) {
      const step = Math.min(240 / 700, zoom)
      await page.mouse.wheel(0, -step * 700)
      zoom -= step
      await page.waitForTimeout(100)
    }
    const yaw = Number(await canvas.getAttribute('data-journey-camera-yaw'))
    const pitch = Number(await canvas.getAttribute('data-journey-camera-pitch'))
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(
      x + (yaw - panel.yaw) / 0.004,
      y + (panel.pitch - pitch) / 0.0035,
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
    await page.waitForTimeout(700)
    const style = await page.addStyleTag({
      content:
        '[data-map-state] > :not(:first-child), section[aria-label="Floating museum map"] > :not(:first-child) { display:none!important; }',
    })
    await canvas.screenshot({
      path: resolve(out, `${panel.file}.png`),
      timeout: 90000,
    })
    await style.evaluate((e) => e.remove())
    proofs.push({
      ...panel,
      metrics: JSON.parse(
        (await canvas.getAttribute('data-renderer-metrics')) ?? '{}',
      ),
    })
    await writeFile(
      resolve(out, 'receipt.json'),
      JSON.stringify(
        {
          url: url.href,
          renderer,
          proofs,
          errors,
          evidence:
            'Actual game raster, desktop Chromium. Not device performance acceptance.',
        },
        null,
        2,
      ) + '\n',
    )
  }
  console.log(JSON.stringify({ out, renderer, proofs: proofs.length, errors }))
  if (errors.length) process.exitCode = 1
} finally {
  await browser.close()
}
