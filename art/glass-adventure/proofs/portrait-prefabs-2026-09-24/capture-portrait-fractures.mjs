// Portrait fracture proof — complete each final voice challenge and capture its authored shards in the shipped renderer.

import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, expect } from '@playwright/test'
import { approachEncounter, captureCanvas, disposeProofFixture, glideVoice, installRuntimeProofFixture, minimizeProofRaster, rendererInfo, setVoice, waitForFrozenShardFrame, zoomTowardEncounter, } from '../runtime-fracture-fixture.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const repo = resolve(here, '../../../..')
const output = resolve(
  process.env.GLASS_PORTRAIT_FRACTURE_OUTPUT ?? resolve(here, 'fractures'),
)
const appOrigin = new URL(
  process.env.GLASS_PORTRAIT_FRACTURE_QA_URL ?? 'http://127.0.0.1:5363',
)
if (!['127.0.0.1', 'localhost'].includes(appOrigin.hostname))
  throw new Error('Portrait proofs must use a local development server.')

const cases = [
  {
    id: 'awakened-muse',
    layout: 'journey',
    title: 'Glassworks Journey',
    levelId: 'glassworks-journey/journey',
    checkpointId: 'glassworks-journey/journey/portrait/checkpoint/entry',
    encounterId:
      'glassworks-journey/journey/portrait/encounter/portrait-finale',
    label: 'Glass portrait',
    direction: { x: 0, z: 1 },
    completedBreakableIds: [
      'glassworks-journey/journey/vestibule/encounter/vestibule-goblet',
      'glassworks-journey/journey/garden/encounter/garden-decanter',
      'glassworks-journey/journey/archive/encounter/archive-carafe',
    ],
    tutorialPreference:
      'tutorial:glassworks-journey/journey:comfortable-hold:v1',
    challenge: 'hold',
    comfortableNote: 57,
    texturePath: '/games/adventure-v5/painting-portrait.webp',
  },
  {
    id: 'interval',
    layout: 'twin-galleries',
    title: 'Twin Galleries',
    levelId: 'glassworks-twin-galleries/twin-galleries',
    checkpointId:
      'glassworks-twin-galleries/twin-galleries/portrait/checkpoint/entry',
    encounterId:
      'glassworks-twin-galleries/twin-galleries/portrait/encounter/portrait-pair',
    label: 'Portrait of two voices',
    direction: { x: -1, z: 0 },
    completedBreakableIds: [
      'glassworks-twin-galleries/twin-galleries/warm/encounter/lower-urn',
      'glassworks-twin-galleries/twin-galleries/cool/encounter/upper-decanter',
      'glassworks-twin-galleries/twin-galleries/court/encounter/bridge-pair',
    ],
    tutorialPreference:
      'tutorial:glassworks-twin-galleries/twin-galleries:comfortable-pair:v1',
    challenge: 'pair',
    comfortablePair: { version: 1, low: 52, high: 64 },
    texturePath: '/games/adventure-v6/interval-between.webp',
  },
  {
    id: 'wave-keeper',
    layout: 'conservatory',
    title: 'Resonance Conservatory',
    levelId: 'glassworks-resonance-conservatory/resonance-conservatory',
    checkpointId:
      'glassworks-resonance-conservatory/resonance-conservatory/wave-salon/checkpoint/entry',
    encounterId:
      'glassworks-resonance-conservatory/resonance-conservatory/wave-salon/encounter/keeper-finale',
    label: 'The keeper of gentle waves',
    direction: { x: -1, z: 0 },
    completedBreakableIds: [
      'glassworks-resonance-conservatory/resonance-conservatory/foyer/encounter/entrance-goblet',
      'glassworks-resonance-conservatory/resonance-conservatory/fern-house/encounter/fern-wave',
      'glassworks-resonance-conservatory/resonance-conservatory/orchid-house/encounter/orchid-wave',
    ],
    tutorialPreference:
      'tutorial:glassworks-resonance-conservatory/resonance-conservatory:settle-and-wave:v2',
    challenge: 'wave',
    comfortableNote: 57,
    texturePath: '/games/adventure-v7/wave-keeper.webp',
  },
]
const geometryPath = '/games/adventure/legend-slab.glb'
const selectedCaseId = process.env.GLASS_PORTRAIT_FRACTURE_CASE
const selectedCases =
  selectedCaseId === undefined
    ? cases
    : cases.filter((proofCase) => proofCase.id === selectedCaseId)
if (selectedCases.length === 0)
  throw new Error(`Unknown portrait fracture proof: ${selectedCaseId}`)

await mkdir(output, { recursive: true })
const browser = await chromium.launch({
  headless: true,
  args: [
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
  ],
})
const proofs = []
try {
  for (const proofCase of selectedCases) {
    console.log(`Fracturing ${proofCase.id} at ${proofCase.checkpointId}`)
    const context = await browser.newContext({
      viewport: { width: 1024, height: 768 },
      deviceScaleFactor: 1,
      reducedMotion: 'no-preference',
    })
    const page = await context.newPage()
    const errors = []
    const observedAssets = new Map()
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text())
    })
    page.on('response', (response) => {
      const path = new URL(response.url()).pathname
      if (path !== geometryPath && path !== proofCase.texturePath) return
      observedAssets.set(
        path,
        response
          .body()
          .then(async (body) => {
            const local = await readFile(
              resolve(repo, 'apps/beside-cue/public', path.slice(1)),
            )
            return {
              path,
              status: response.status(),
              bytes: body.length,
              sha256: createHash('sha256').update(body).digest('hex'),
              matchesLocal: body.equals(local),
            }
          })
          .catch((error) => ({ path, error: String(error) })),
      )
    })

    try {
      await installRuntimeProofFixture(page, {
        levelId: proofCase.levelId,
        checkpointId: proofCase.checkpointId,
        completedBreakableIds: proofCase.completedBreakableIds,
        tutorialPreference: proofCase.tutorialPreference,
        comfortableNote: proofCase.comfortableNote,
        comfortablePair: proofCase.comfortablePair,
        freezeAtCompleted: 4,
        freezeDelayMs: 250,
      })
      const caseUrl = new URL(
        `/glass-game/?layout=${proofCase.layout}`,
        appOrigin,
      )
      await page.goto(caseUrl.href, { waitUntil: 'domcontentloaded' })
      const adventure = page.getByTestId('glass-adventure')
      await expect(adventure).toHaveAttribute('data-ready', 'true', {
        timeout: 90_000,
      })
      await expect(adventure).toHaveAttribute('data-completed', '3')
      await expect
        .poll(() => observedAssets.size, {
          timeout: 20_000,
          intervals: [50],
        })
        .toBe(2)
      await Promise.all(observedAssets.values())
      await minimizeProofRaster(page)
      await approachEncounter(page, {
        checkpointId: proofCase.checkpointId,
        label: proofCase.label,
        direction: proofCase.direction,
      })
      await zoomTowardEncounter(page, 2)
      await setVoice(page, proofCase.challenge === 'pair' ? 52 : 57, 0)
      await page.getByRole('button', { name: 'Sing to the glass' }).click()
      const panel = page.getByLabel('Voice challenge')
      await expect(panel).toHaveAttribute('data-voice-mode', 'reference', {
        timeout: 10_000,
      })
      await expect(panel).toHaveAttribute('data-voice-mode', 'singing', {
        timeout: 12_000,
      })

      if (proofCase.challenge === 'hold') {
        await setVoice(page, 57, 0.1)
      } else if (proofCase.challenge === 'pair') {
        await setVoice(page, 52, 0.1)
        await expect(panel).toHaveAttribute('data-step-index', '1', {
          timeout: 12_000,
        })
        await setVoice(page, 64, 0.1)
      } else {
        await setVoice(page, 57, 0.1)
        await expect(panel).toHaveAttribute('data-step-index', '1', {
          timeout: 12_000,
        })
        wave: for (let cycle = 0; cycle < 4; cycle++)
          for (const midi of [59, 57, 55, 57]) {
            await glideVoice(page, midi, 0.35)
            if ((await adventure.getAttribute('data-completed')) === '4')
              break wave
          }
      }

      await expect(adventure).toHaveAttribute('data-completed', '4', {
        timeout: 20_000,
      })
      const freeze = await waitForFrozenShardFrame(page)
      const sceneState = await adventure.evaluate((element) => ({
        checkpointId: element.getAttribute('data-checkpoint'),
        player: {
          x: Number(element.getAttribute('data-player-x')),
          y: Number(element.getAttribute('data-player-y')),
          z: Number(element.getAttribute('data-player-z')),
        },
        cameraYaw: Number(element.getAttribute('data-camera-yaw')),
        challengeCamera: JSON.parse(
          element.getAttribute('data-challenge-camera') ?? 'null',
        ),
      }))
      const file = `${proofCase.id}-fracture.png`
      await captureCanvas(
        page,
        resolve(output, file),
        `data-${proofCase.id}-fracture-proof-hidden`,
      )
      const assets = await Promise.all(observedAssets.values())
      for (const expectedPath of [geometryPath, proofCase.texturePath])
        if (!assets.some((asset) => asset.path === expectedPath))
          errors.push(`Runtime asset was not observed: ${expectedPath}`)
      if (assets.some((asset) => asset.status !== 200))
        errors.push('A portrait fracture asset did not return HTTP 200.')
      if (assets.some((asset) => asset.matchesLocal === false))
        errors.push('A served portrait asset differed from its local file.')
      const savedProgress = await page.evaluate((levelId) => {
        const raw = localStorage.getItem(
          `beside-cue:glass-adventure:progress:${levelId}`,
        )
        return raw === null ? null : JSON.parse(raw)
      }, proofCase.levelId)
      proofs.push({
        id: proofCase.id,
        title: proofCase.title,
        url: caseUrl.href,
        encounterId: proofCase.encounterId,
        checkpointId: proofCase.checkpointId,
        completedMainExhibits: Number(
          await adventure.getAttribute('data-completed'),
        ),
        sceneState,
        screenshot: file,
        screenshotSha256: createHash('sha256')
          .update(await readFile(resolve(output, file)))
          .digest('hex'),
        freeze,
        renderer: await rendererInfo(page),
        assets,
        savedProgress,
        errors,
      })
    } finally {
      await disposeProofFixture(page).catch(() => undefined)
      await context.close()
    }
  }
} finally {
  await browser.close()
}

const manifest = {
  capturedAt: new Date().toISOString(),
  server: appOrigin.origin,
  viewport: { width: 1024, height: 768, deviceScaleFactor: 1 },
  rasterization:
    'Recorded frames use the shipped Three/WebGL2 renderer at full resolution with the original draw methods restored; navigation and real-audio challenge input temporarily suppress raster draw calls to keep SwiftShader timing bounded.',
  scope:
    'Short visual proof of the three final portrait prefabs during their live authored fracture state.',
  proofs,
}
await writeFile(
  resolve(output, 'manifest.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
)
console.log(
  JSON.stringify(
    proofs.map(({ id, screenshot, renderer, assets, errors }) => ({
      id,
      screenshot,
      renderer: renderer.renderer,
      assets: assets.length,
      errors,
    })),
    null,
    2,
  ),
)
if (proofs.some((proof) => proof.errors.length > 0)) process.exitCode = 1
