// Capture close museum inspection and animated water from the compiled application.
import { chromium, expect } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const url =
  process.env.JOURNEY_PROOF_URL ??
  'https://127.0.0.1:5295/glass-game/?campaign=1'
const output = new URL('../proofs/inspection/', import.meta.url)
const proofCase = process.env.JOURNEY_PROOF_CASE ?? 'all'
await mkdir(output, { recursive: true })
const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const proofs = []
async function record(proof) {
  proofs.push(proof)
  await writeFile(
    new URL(
      proofCase === 'all' ? 'manifest.json' : `manifest-${proofCase}.json`,
      output,
    ),
    `${JSON.stringify({ url, capturedAt: new Date().toISOString(), evidence: 'Actual compiled scene; real wheel and mouse drag. SwiftShader, not device performance acceptance.', proofs }, null, 2)}\n`,
  )
}
try {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 1000 },
    ignoreHTTPSErrors: true,
    reducedMotion: 'reduce',
  })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  const frame = page.locator('[data-map-state]')
  const canvas = frame.locator('canvas')
  await expect(frame).toHaveAttribute('data-map-state', 'ready', {
    timeout: 90000,
  })
  for (const [id, title, yawDrag] of [
    ['first-light-isle', 'First Light Gallery', 0],
    ['glassworks-isle', 'Glassworks Journey', 160],
    ['twin-galleries-isle', 'Twin Galleries', -200],
    ['resonance-conservatory-isle', 'Resonance Conservatory', 180],
  ].filter(([id]) => proofCase === 'all' || proofCase === id)) {
    if (
      await page.getByRole('button', { name: 'Reset museum view' }).isVisible()
    )
      await page.getByRole('button', { name: 'Reset museum view' }).click()
    await page
      .getByRole('navigation', { name: 'Select a museum island' })
      .getByRole('button', {
        name: `Select ${title} on the museum map`,
        exact: true,
      })
      .click()
    await page.mouse.move(70, 410)
    for (let tick = 0; tick < 3; tick++) {
      await page.mouse.wheel(0, -240)
      await page.waitForTimeout(100)
    }
    await expect(canvas).toHaveAttribute('data-journey-camera-zoom', '1.000')
    if (yawDrag) {
      await page.mouse.move(760, 220)
      await page.mouse.down()
      await page.mouse.move(760 + yawDrag, 220)
      await page.mouse.up()
    }
    await page.waitForTimeout(1000)
    const path = new URL(`${id}-close.png`, output)
    // Dense close views can exceed Playwright's default 30s readback budget
    // under SwiftShader. This only bounds capture, not application readiness.
    await page.screenshot({ path: fileURLToPath(path), timeout: 90000 })
    await record({
      id,
      screenshot: path.pathname.split('/').at(-1),
      camera: await canvas.evaluate((element) => ({
        zoom: element.dataset.journeyCameraZoom,
        yaw: element.dataset.journeyCameraYaw,
        pitch: element.dataset.journeyCameraPitch,
      })),
      errors: [...errors],
    })
  }
  if (proofCase === 'all' || proofCase === 'water') {
    if (
      await page.getByRole('button', { name: 'Reset museum view' }).isVisible()
    )
      await page.getByRole('button', { name: 'Reset museum view' }).click()
    await page
      .getByRole('navigation', { name: 'Select a museum island' })
      .getByRole('button', {
        name: 'Select Twin Galleries on the museum map',
        exact: true,
      })
      .click()
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    // The full overview keeps the mist below all three islands in frame.
    await page.waitForTimeout(2000)
    for (let frameIndex = 0; frameIndex < 3; frameIndex++) {
      const filename = `water-motion-${frameIndex}.png`
      await page.screenshot({
        path: fileURLToPath(new URL(filename, output)),
      })
      await record({
        id: `water-motion-${frameIndex}`,
        screenshot: filename,
        errors: [...errors],
      })
      await page.waitForTimeout(1400)
    }
  }
  await context.close()
} finally {
  await browser.close()
}
if (proofs.some((proof) => proof.errors.length))
  throw new Error('Inspection contains browser errors')
console.log(JSON.stringify(proofs))
