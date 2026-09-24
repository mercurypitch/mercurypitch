// Capture Cloudway's real-raster backdrop fog from the arrival camera and two orbit/zoom variants.
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { cloudwayAssetBaseline } from './proof-assets.mjs'

const require = createRequire(
  new URL('../../../../package.json', import.meta.url),
)
const { chromium } = require('@playwright/test')
const source = new URL(
  process.env.CLOUDWAY_PROOF_URL ??
    'http://127.0.0.1:5340/glass-game/?layout=cloudway',
)
if (!['127.0.0.1', 'localhost'].includes(source.hostname))
  throw new Error('Proofs must use a local development renderer.')
const output =
  process.env.CLOUDWAY_PROOF_OUTPUT ??
  fileURLToPath(new URL('.', import.meta.url))
const proofCase = process.env.CLOUDWAY_PROOF_CASE ?? 'all'
if (!['all', 'left'].includes(proofCase))
  throw new Error('CLOUDWAY_PROOF_CASE must be "all" or "left".')
const manifestFile =
  process.env.CLOUDWAY_PROOF_MANIFEST ??
  (proofCase === 'all' ? 'fog-manifest.json' : 'fog-radial-left-manifest.json')
const assetBaseline = await cloudwayAssetBaseline()
await mkdir(output, { recursive: true })

const browser = await chromium.launch({
  args: [
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
  ],
})
const evidence = []

try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1.5,
    reducedMotion: 'reduce',
  })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(`page: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`)
  })
  await page.addInitScript(() => {
    const prefix = 'beside-cue:glass-adventure:'
    localStorage.setItem(`${prefix}tutorial`, 'seen')
    localStorage.setItem(
      `${prefix}tutorial:cloudway-glass-ribbon:cloudway-first-crossing:v1`,
      'seen',
    )
  })
  await page.goto(source.href)
  const game = page.getByTestId('glass-adventure')
  await game.waitFor({ state: 'visible', timeout: 30_000 })
  await page.waitForFunction(
    () =>
      document
        .querySelector('[data-testid="glass-adventure"]')
        ?.getAttribute('data-ready') === 'true',
    undefined,
    { timeout: 90_000 },
  )
  const skip = page.getByRole('button', { name: /skip/i })
  if (await skip.isVisible()) await skip.click()
  assert.equal(
    await game.getAttribute('data-checkpoint'),
    'cloudway-checkpoint-arrival',
  )

  const viewport = page.getByLabel('Glass museum; drag to look around')
  const frames = (count) =>
    page.evaluate(
      (remaining) =>
        new Promise((resolve) => {
          const frame = () =>
            --remaining <= 0 ? resolve() : requestAnimationFrame(frame)
          requestAnimationFrame(frame)
        }),
      count,
    )
  const raster = async () => {
    const canvas = page.locator('canvas[aria-label="Floating glass museum"]')
    return canvas.evaluate((element) => {
      const bounds = element.getBoundingClientRect()
      return {
        cssWidth: bounds.width,
        cssHeight: bounds.height,
        pixelWidth: element.width,
        pixelHeight: element.height,
        devicePixelRatio: window.devicePixelRatio,
      }
    })
  }
  const capture = async (id, action) => {
    await frames(30)
    const file = `${id}.png`
    await page.screenshot({ path: `${output}/${file}`, timeout: 90_000 })
    evidence.push({
      id,
      action,
      yaw: Number(await game.getAttribute('data-camera-yaw')),
      raster: await raster(),
      file,
    })
  }
  const setYaw = async (target) => {
    const bounds = await viewport.boundingBox()
    if (bounds === null) throw new Error('Missing museum viewport bounds.')
    let remaining =
      -(target - Number(await game.getAttribute('data-camera-yaw'))) / 0.005
    while (Math.abs(remaining) > 0.01) {
      const distance = Math.max(-240, Math.min(240, remaining))
      await page.mouse.move(
        bounds.x + bounds.width / 2,
        bounds.y + bounds.height / 2,
      )
      await page.mouse.down()
      await page.mouse.move(
        bounds.x + bounds.width / 2 + distance,
        bounds.y + bounds.height / 2,
        { steps: 8 },
      )
      await page.mouse.up()
      remaining -= distance
    }
  }

  const authoredYaw = Number(await game.getAttribute('data-camera-yaw'))
  if (proofCase === 'all') {
    await capture('cloudway-fog-arrival-default', {
      kind: 'authored-arrival-camera',
    })
  }
  await setYaw(authoredYaw - 0.58)
  await page.mouse.wheel(0, 1000)
  await capture('cloudway-fog-arrival-left-zoom-out', {
    kind: 'real-mouse-orbit-and-wheel',
    yawOffset: -0.58,
    wheelDeltaY: 1000,
  })
  if (proofCase === 'all') {
    await page.getByRole('button', { name: 'Recenter camera' }).click()
    await setYaw(authoredYaw + 0.58)
    await page.mouse.wheel(0, -2000)
    await capture('cloudway-fog-arrival-right-zoom-in', {
      kind: 'real-mouse-orbit-and-wheel',
      yawOffset: 0.58,
      wheelDeltaY: -2000,
    })
  }

  assert.deepEqual(errors, [])
  await writeFile(
    `${output}/${manifestFile}`,
    `${JSON.stringify(
      {
        capturedAt: new Date().toISOString(),
        url: source.href,
        rendering:
          'Real WebGL2 raster through SwiftShader at devicePixelRatio 1.5; no draw suppression or canvas resizing.',
        proofScope:
          proofCase === 'all'
            ? 'Fresh Cloudway development arrival, plus real mouse orbit and wheel zoom variants.'
            : 'Fresh Cloudway development arrival after a real mouse left orbit and wheel zoom out.',
        limitations:
          'Appearance evidence only; this does not prove route traversal or physical-device performance.',
        assetBaseline,
        evidence,
        errors,
      },
      null,
      2,
    )}\n`,
  )
  await context.close()
} finally {
  await browser.close()
}
