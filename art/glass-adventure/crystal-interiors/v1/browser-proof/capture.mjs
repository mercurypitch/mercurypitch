import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { chromium } from '@playwright/test'

const sourceRoot = path.resolve(
  process.env.GLASS_CRYSTAL_INTERIOR_SOURCE_ROOT ??
    path.join(
      process.env.HOME,
      'Documents/root/5-Creative/besidecue/assets/glass-adventure/crystal-interiors/v1',
    ),
)
const proofDir = path.join(sourceRoot, 'proofs/browser')
const url = process.env.CRYSTAL_INTERIOR_PROOF_URL ?? 'http://127.0.0.1:5679/'
const hash = (value) => createHash('sha256').update(value).digest('hex')

await mkdir(proofDir, { recursive: true })
const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage({
    viewport: { width: 1100, height: 640 },
    deviceScaleFactor: 1,
  })
  const errors = []
  page.on('pageerror', (error) => errors.push(error.stack ?? error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  await page.goto(url, { waitUntil: 'networkidle' })
  try {
    await page.waitForFunction(
      () => window.__CRYSTAL_INTERIOR_PROOF__?.ready === true,
      undefined,
      { timeout: 15_000 },
    )
  } catch (error) {
    const pageError = await page.evaluate(() => document.body.dataset.error)
    throw new Error(
      `Crystal proof did not become ready: ${pageError ?? String(error)}\n${errors.join('\n')}`,
    )
  }
  await page.waitForTimeout(900)
  const before = await page.screenshot()
  await page.waitForTimeout(600)
  const after = await page.screenshot()
  if (hash(before) === hash(after))
    throw new Error('Animated runtime frames are identical.')

  await page.evaluate(() => window.__CRYSTAL_INTERIOR_PROOF__.setPaused(true))
  await page.waitForTimeout(120)
  const pausedBefore = await page.screenshot()
  await page.waitForTimeout(280)
  const pausedAfter = await page.screenshot()
  if (hash(pausedBefore) !== hash(pausedAfter))
    throw new Error('Paused runtime frame changed.')

  await page.evaluate(() => {
    window.__CRYSTAL_INTERIOR_PROOF__.setPaused(false)
    window.__CRYSTAL_INTERIOR_PROOF__.setReducedMotion(true)
  })
  await page.waitForTimeout(120)
  const reducedBefore = await page.screenshot()
  await page.waitForTimeout(280)
  const reducedAfter = await page.screenshot()
  if (hash(reducedBefore) !== hash(reducedAfter))
    throw new Error('Reduced-motion runtime frame changed.')

  await page.evaluate(() => {
    window.__CRYSTAL_INTERIOR_PROOF__.reset()
    window.__CRYSTAL_INTERIOR_PROOF__.setPaused(true)
  })
  await page.waitForTimeout(120)
  const fullPath = path.join(
    proofDir,
    'crystal-interiors-real-scroll-shells.png',
  )
  await page.screenshot({ path: fullPath })
  await page.evaluate(() => {
    window.__CRYSTAL_INTERIOR_PROOF__.setReducedMotion(false)
    window.__CRYSTAL_INTERIOR_PROOF__.setResonanceRetraction(0.36)
  })
  await page.waitForTimeout(300)
  const retractedPath = path.join(
    proofDir,
    'resonance-veins-real-scroll-retracted.png',
  )
  await page.screenshot({ path: retractedPath })
  const runtime = await page.evaluate(() => ({
    costs: window.__CRYSTAL_INTERIOR_PROOF__.costs,
    renderer: window.__CRYSTAL_INTERIOR_PROOF__.renderer,
    shell: window.__CRYSTAL_INTERIOR_PROOF__.shell,
    states: window.__CRYSTAL_INTERIOR_PROOF__.states(),
  }))
  if (
    runtime.renderer.transmissionResolutionScale !== 0.5 ||
    runtime.renderer.toneMappingExposure !== 0.9 ||
    runtime.shell.background?.source !== 'journey-map-v3/cloudscape.webp'
  )
    throw new Error(
      `Standalone proof is not using production presentation settings: ${JSON.stringify(
        runtime,
      )}`,
    )
  const resetStates = await page.evaluate(() => {
    window.__CRYSTAL_INTERIOR_PROOF__.reset()
    return window.__CRYSTAL_INTERIOR_PROOF__.states()
  })
  if (
    resetStates.some(
      (state) =>
        state.elapsedSeconds !== 0 ||
        state.scrollVisibleFraction !== 1 ||
        state.settings.reducedMotion,
    )
  )
    throw new Error('Reset did not restore the deterministic start state.')
  if (errors.length > 0)
    throw new Error(`Browser logged runtime errors:\n${errors.join('\n')}`)
  const full = await readFile(fullPath)
  const retracted = await readFile(retractedPath)
  const report = {
    schema: 1,
    status: 'real Three.js WebGL capture through certified scroll GLB passed',
    url,
    viewport: [1100, 640],
    renderer: runtime.renderer,
    shell: runtime.shell,
    animatedFramesDiffer: true,
    pausedFramesMatch: true,
    reducedMotionFramesMatch: true,
    resetRestoresStart: true,
    costs: runtime.costs,
    retractionState: runtime.states[0],
    screenshots: [
      {
        file: 'proofs/browser/crystal-interiors-real-scroll-shells.png',
        bytes: full.length,
        sha256: hash(full),
      },
      {
        file: 'proofs/browser/resonance-veins-real-scroll-retracted.png',
        bytes: retracted.length,
        sha256: hash(retracted),
      },
    ],
    scope:
      'Headless Chromium WebGL evidence using the accepted GLB and scroll adapter; device frame time and thermals are not inferred.',
  }
  await writeFile(
    path.join(sourceRoot, 'runtime-proof.json'),
    `${JSON.stringify(report, null, 2)}\n`,
  )
  process.stdout.write(
    `CRYSTAL_INTERIOR_RUNTIME_PROOF=${JSON.stringify(report)}\n`,
  )
} finally {
  await browser.close()
}
