// Celadon runtime proof — capture the accepted decanter intact and during its real in-game fracture.

import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, expect } from '@playwright/test'
import { approachEncounter, captureCanvas, disposeProofFixture, installRuntimeProofFixture, minimizeProofRaster, rendererInfo, restoreAndPauseProofFrame, resumeWithMinimizedProofRaster, setVoice, waitForFrozenShardFrame, zoomTowardEncounter, } from '../../../proofs/runtime-fracture-fixture.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const repo = resolve(here, '../../../../..')
const output = resolve(here, 'captures')
const appUrl = new URL(
  '/glass-game/?layout=twin-galleries',
  process.env.GLASS_CELADON_QA_URL ?? 'http://127.0.0.1:5363',
)
if (!['127.0.0.1', 'localhost'].includes(appUrl.hostname))
  throw new Error('Celadon proofs must use a local development server.')

const levelId = 'glassworks-twin-galleries/twin-galleries'
const lowerId = `${levelId}/warm/encounter/lower-urn`
const upperId = `${levelId}/cool/encounter/upper-decanter`
const checkpointId = `${levelId}/cool/checkpoint/entry`
const assetPath = '/games/adventure-v6/celadon-lark-decanter-fracture-v4.glb'

await mkdir(output, { recursive: true })
const browser = await chromium.launch({
  headless: true,
  args: [
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
  ],
})

const context = await browser.newContext({
  viewport: { width: 1024, height: 768 },
  deviceScaleFactor: 1,
  reducedMotion: 'no-preference',
})
const page = await context.newPage()
const errors = []
let assetResponse
page.on('pageerror', (error) => errors.push(error.message))
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text())
})
page.on('response', (response) => {
  if (new URL(response.url()).pathname !== assetPath) return
  assetResponse = response
    .body()
    .then(async (body) => {
      const local = await readFile(
        resolve(repo, 'apps/beside-cue/public', assetPath.slice(1)),
      )
      return {
        path: assetPath,
        status: response.status(),
        bytes: body.length,
        sha256: createHash('sha256').update(body).digest('hex'),
        matchesLocal: body.equals(local),
      }
    })
    .catch((error) => ({ path: assetPath, error: String(error) }))
})

let proof
try {
  await installRuntimeProofFixture(page, {
    levelId,
    checkpointId,
    completedBreakableIds: [lowerId],
    tutorialPreference: `tutorial:${levelId}:comfortable-pair:v1`,
    comfortablePair: { version: 1, low: 52, high: 64 },
    freezeAtCompleted: 2,
    freezeDelayMs: 160,
  })
  await page.goto(appUrl.href, { waitUntil: 'domcontentloaded' })
  const adventure = page.getByTestId('glass-adventure')
  await expect(adventure).toHaveAttribute('data-ready', 'true', {
    timeout: 90_000,
  })
  await expect(adventure).toHaveAttribute('data-completed', '1')
  await minimizeProofRaster(page)
  try {
    await approachEncounter(page, {
      checkpointId,
      label: 'Celadon lark decanter',
      direction: { x: 1, z: 0 },
    })
  } catch (error) {
    throw new Error(`${String(error)}\nPage errors: ${JSON.stringify(errors)}`)
  }
  await zoomTowardEncounter(page, 2)
  await expect.poll(() => assetResponse !== undefined).toBe(true)
  const asset = await assetResponse
  if (asset.status !== 200)
    errors.push(`Celadon asset returned ${asset.status}.`)
  if (asset.matchesLocal === false)
    errors.push(
      'Served Celadon asset differed from the checked-in runtime file.',
    )

  const intactFile = 'celadon-lark-decanter-game-distance-intact-v4.png'
  await restoreAndPauseProofFrame(page)
  await captureCanvas(
    page,
    resolve(output, intactFile),
    'data-celadon-intact-proof-hidden',
  )
  await resumeWithMinimizedProofRaster(page)
  await zoomTowardEncounter(page, 1)

  await setVoice(page, 64, 0)
  await page.getByRole('button', { name: 'Sing to the glass' }).click()
  const panel = page.getByLabel('Voice challenge')
  await expect(panel).toHaveAttribute('data-voice-mode', 'reference', {
    timeout: 10_000,
  })
  await expect(panel).toHaveAttribute('data-voice-mode', 'singing', {
    timeout: 12_000,
  })
  await setVoice(page, 64, 0.1)
  await expect(adventure).toHaveAttribute('data-completed', '2', {
    timeout: 20_000,
  })
  const freeze = await waitForFrozenShardFrame(page)
  const fractureFile = 'celadon-lark-decanter-game-distance-fracture-v4.png'
  await captureCanvas(
    page,
    resolve(output, fractureFile),
    'data-celadon-fracture-proof-hidden',
  )

  const savedProgress = await page.evaluate((levelId) => {
    const raw = localStorage.getItem(
      `beside-cue:glass-adventure:progress:${levelId}`,
    )
    return raw === null ? null : JSON.parse(raw)
  }, levelId)
  const state = await adventure.evaluate((element) => ({
    levelId: element.getAttribute('data-level-id'),
    checkpointId: element.getAttribute('data-checkpoint'),
    completedMainExhibits: Number(element.getAttribute('data-completed')),
    player: {
      x: Number(element.getAttribute('data-player-x')),
      y: Number(element.getAttribute('data-player-y')),
      z: Number(element.getAttribute('data-player-z')),
    },
    cameraYaw: Number(element.getAttribute('data-camera-yaw')),
  }))
  const screenshots = await Promise.all(
    [intactFile, fractureFile].map(async (file) => ({
      file,
      sha256: createHash('sha256')
        .update(await readFile(resolve(output, file)))
        .digest('hex'),
    })),
  )
  proof = {
    capturedAt: new Date().toISOString(),
    server: appUrl.origin,
    url: appUrl.href,
    viewport: { width: 1024, height: 768, deviceScaleFactor: 1 },
    rasterization:
      'Recorded frames use the shipped Twin Galleries Three/WebGL2 renderer at full resolution with the original draw methods restored; navigation and real-audio challenge input temporarily suppress raster draw calls to keep SwiftShader timing bounded.',
    encounter: {
      id: upperId,
      label: 'Celadon lark decanter',
      preservedCompletedBeforeCapture: [lowerId],
    },
    ...state,
    freeze,
    renderer: await rendererInfo(page),
    asset,
    screenshots,
    savedProgress,
    errors,
  }
} finally {
  await disposeProofFixture(page).catch(() => undefined)
  await context.close()
  await browser.close()
}

if (proof === undefined) throw new Error('Celadon proof did not complete.')
await writeFile(
  resolve(output, 'manifest.json'),
  `${JSON.stringify(proof, null, 2)}\n`,
)
console.log(JSON.stringify(proof, null, 2))
if (proof.errors.length > 0) process.exitCode = 1
