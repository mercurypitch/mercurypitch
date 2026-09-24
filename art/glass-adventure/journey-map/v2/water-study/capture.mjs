// Capture deterministic mist-free water motion and reduced-motion evidence through the repo Vite server.

import { chromium } from '@playwright/test'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { writeFile } from 'node:fs/promises'
import sharp from 'sharp'

const here = fileURLToPath(new URL('.', import.meta.url))
const origin = process.env.WATER_STUDY_ORIGIN ?? 'http://127.0.0.1:5224'
const url = `${origin}/@fs${here}index.html`
const viewport = { width: 800, height: 600 }
const browser = await chromium.launch({
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex')
}

async function changedPixels(before, after, threshold = 7) {
  const first = await sharp(before).removeAlpha().raw().toBuffer({
    resolveWithObject: true,
  })
  const second = await sharp(after).removeAlpha().raw().toBuffer({
    resolveWithObject: true,
  })
  if (
    first.info.width !== second.info.width ||
    first.info.height !== second.info.height ||
    first.info.channels !== second.info.channels
  )
    throw new Error('Water proof frames have incompatible dimensions.')
  let changed = 0
  for (let index = 0; index < first.data.length; index += first.info.channels) {
    let maximum = 0
    for (let channel = 0; channel < first.info.channels; channel++)
      maximum = Math.max(
        maximum,
        Math.abs(first.data[index + channel] - second.data[index + channel]),
      )
    if (maximum > threshold) changed++
  }
  return {
    changed,
    total: first.info.width * first.info.height,
    ratio: changed / (first.info.width * first.info.height),
  }
}

const pageErrors = []
const consoleErrors = []
let page
try {
  page = await browser.newPage({ viewport })
  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  await page.goto(`${url}?mist=0`, {
    waitUntil: 'domcontentloaded',
    timeout: 30_000,
  })
  await page.waitForFunction(
    () => document.documentElement.dataset.ready === 'true',
    undefined,
    { timeout: 30_000 },
  )
  const canvas = page.locator('canvas')
  const capture = async (filename, seconds, reducedMotion, mistEnabled) => {
    const metrics = await page.evaluate(
      ({ seconds, reducedMotion }) =>
        window.waterStudy.renderAt(seconds, reducedMotion),
      { seconds, reducedMotion },
    )
    const image = await canvas.screenshot({ path: `${here}${filename}` })
    return {
      filename,
      seconds,
      reducedMotion,
      mistEnabled,
      image,
      metrics,
      sha256: sha256(image),
    }
  }

  const first = await capture('water-flow-0000ms.png', 0, false, false)
  const second = await capture('water-flow-1400ms.png', 1.4, false, false)
  const reducedFirst = await capture('water-reduced-2000ms.png', 2, true, false)
  const reducedSecond = await capture(
    'water-reduced-3200ms.png',
    3.2,
    true,
    false,
  )
  const movingDifference = await changedPixels(first.image, second.image)
  const reducedDifference = await changedPixels(
    reducedFirst.image,
    reducedSecond.image,
    0,
  )

  if (first.metrics.water.mistParticles !== 0)
    throw new Error('Water-only proof unexpectedly created mist particles.')
  if (first.metrics.water.secondaryRenderPasses !== 0)
    throw new Error('Water-only proof created a secondary render pass.')
  if (movingDifference.ratio < 0.003)
    throw new Error(
      `Water motion changed only ${(movingDifference.ratio * 100).toFixed(3)}% of pixels.`,
    )
  if (reducedDifference.changed !== 0)
    throw new Error(
      `Reduced-motion water changed ${reducedDifference.changed} pixels while time advanced.`,
    )

  await page.goto(`${url}?mist=1`, {
    waitUntil: 'domcontentloaded',
    timeout: 30_000,
  })
  await page.waitForFunction(
    () => document.documentElement.dataset.ready === 'true',
    undefined,
    { timeout: 30_000 },
  )
  const withMist = await capture('water-with-mist-1400ms.png', 1.4, false, true)
  if (
    withMist.metrics.water.mistParticles !== 36 ||
    withMist.metrics.renderer.points !== 36
  )
    throw new Error('The pooled impact mist did not render its bounded points.')
  if (pageErrors.length > 0 || consoleErrors.length > 0)
    throw new Error([...pageErrors, ...consoleErrors].join('\n'))

  const manifest = {
    capturedAt: new Date().toISOString(),
    source: 'packages/glass-game/src/journey/water.ts',
    origin,
    viewport,
    renderer: 'Chromium SwiftShader through the repo Vite server',
    motionComparisonMistEnabled: false,
    frames: [first, second, reducedFirst, reducedSecond, withMist].map(
      ({ image: _image, ...record }) => record,
    ),
    movingDifference,
    reducedDifference,
    pageErrors,
    consoleErrors,
    limitations: [
      'Software rendering verifies shader execution and deterministic motion, not device FPS.',
      'This isolated proof does not measure the future complete journey-map scene.',
    ],
  }
  await writeFile(
    `${here}manifest.json`,
    `${JSON.stringify(manifest, null, 2)}\n`,
  )
  console.log(JSON.stringify(manifest, null, 2))
  await page.evaluate(() => window.waterStudy.dispose())
} finally {
  await page?.close()
  await browser.close()
}
