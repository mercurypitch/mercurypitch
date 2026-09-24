// Portrait prefab proof capture — load each final portrait inside its authored gallery with real Three/WebGL drawing.

import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, expect } from '@playwright/test'

const here = dirname(fileURLToPath(import.meta.url))
const repo = resolve(here, '../../../..')
const output = resolve(here, 'captures')
const appUrl = new URL(
  '/glass-game/?campaign=1',
  process.env.GLASS_PORTRAIT_QA_URL ?? 'http://127.0.0.1:5357',
)
if (!['127.0.0.1', 'localhost'].includes(appUrl.hostname))
  throw new Error('Portrait proofs must use a local development server.')

const prefix = 'beside-cue:glass-adventure'
const cases = [
  {
    id: 'awakened-muse',
    layout: 'journey',
    title: 'Glassworks Journey',
    levelId: 'glassworks-journey/journey',
    checkpointId: 'glassworks-journey/journey/portrait/checkpoint/entry',
    completedBreakableIds: [
      'glassworks-journey/journey/vestibule/encounter/vestibule-goblet',
      'glassworks-journey/journey/garden/encounter/garden-decanter',
      'glassworks-journey/journey/archive/encounter/archive-carafe',
    ],
    tutorialPreference:
      'tutorial:glassworks-journey/journey:comfortable-hold:v1',
    texturePath: '/games/adventure-v5/painting-portrait.webp',
  },
  {
    id: 'interval',
    layout: 'twin-galleries',
    title: 'Twin Galleries',
    levelId: 'glassworks-twin-galleries/twin-galleries',
    checkpointId:
      'glassworks-twin-galleries/twin-galleries/portrait/checkpoint/entry',
    completedBreakableIds: [
      'glassworks-twin-galleries/twin-galleries/warm/encounter/lower-urn',
      'glassworks-twin-galleries/twin-galleries/cool/encounter/upper-decanter',
      'glassworks-twin-galleries/twin-galleries/court/encounter/bridge-pair',
    ],
    tutorialPreference:
      'tutorial:glassworks-twin-galleries/twin-galleries:comfortable-pair:v1',
    texturePath: '/games/adventure-v6/interval-between.webp',
  },
  {
    id: 'wave-keeper',
    layout: 'conservatory',
    title: 'Resonance Conservatory',
    levelId: 'glassworks-resonance-conservatory/resonance-conservatory',
    checkpointId:
      'glassworks-resonance-conservatory/resonance-conservatory/wave-salon/checkpoint/entry',
    completedBreakableIds: [
      'glassworks-resonance-conservatory/resonance-conservatory/foyer/encounter/entrance-goblet',
      'glassworks-resonance-conservatory/resonance-conservatory/fern-house/encounter/fern-wave',
      'glassworks-resonance-conservatory/resonance-conservatory/orchid-house/encounter/orchid-wave',
    ],
    tutorialPreference:
      'tutorial:glassworks-resonance-conservatory/resonance-conservatory:settle-and-wave:v2',
    texturePath: '/games/adventure-v7/wave-keeper.webp',
  },
]

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
  for (const proofCase of cases) {
    console.log(`Loading ${proofCase.id} at ${proofCase.checkpointId}`)
    const context = await browser.newContext({
      viewport: { width: 1024, height: 768 },
      deviceScaleFactor: 1,
      reducedMotion: 'reduce',
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
      if (
        path !== proofCase.texturePath &&
        path !== '/games/adventure/legend-slab.glb'
      )
        return
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
    await page.addInitScript(
      ({ prefix, proofCase }) => {
        localStorage.setItem(`${prefix}:tutorial`, 'seen')
        localStorage.setItem(
          `${prefix}:${proofCase.tutorialPreference}`,
          'seen',
        )
        localStorage.setItem(
          `${prefix}:museum-audio:v1`,
          JSON.stringify({ muted: true, music: 0, ambience: 0 }),
        )
        localStorage.setItem(
          `${prefix}:progress:${proofCase.levelId}`,
          JSON.stringify({
            version: 2,
            levelId: proofCase.levelId,
            checkpointId: proofCase.checkpointId,
            completedBreakableIds: proofCase.completedBreakableIds,
            finished: false,
            rewards: {
              version: 1,
              discoveredEncounterIds: [],
              collectedCoinIds: [],
              qualityResults: [],
              collectedPortraitIds: [],
            },
          }),
        )
      },
      { prefix, proofCase },
    )
    const caseUrl = new URL(`/glass-game/?layout=${proofCase.layout}`, appUrl)
    await page.goto(caseUrl.href, { waitUntil: 'domcontentloaded' })
    const adventure = page.getByTestId('glass-adventure')
    await expect(adventure).toHaveAttribute('data-ready', 'true', {
      timeout: 90_000,
    })
    await expect(adventure).toHaveAttribute(
      'data-checkpoint',
      proofCase.checkpointId,
    )
    const tutorial = page.getByRole('button', { name: 'Skip tutorial' })
    if (await tutorial.isVisible().catch(() => false)) await tutorial.click()

    const viewport = page.getByLabel('Glass museum; drag to look around')
    await viewport.focus()
    await page.getByRole('button', { name: 'Recenter camera' }).click()
    await page.keyboard.down('KeyW')
    await page.waitForTimeout(950)
    await page.keyboard.up('KeyW')
    await page.waitForTimeout(500)
    const bounds = await viewport.boundingBox()
    if (!bounds) throw new Error(`No museum viewport for ${proofCase.id}.`)
    await page.mouse.move(
      bounds.x + bounds.width / 2,
      bounds.y + bounds.height / 2,
    )
    for (let step = 0; step < 3; step++) await page.mouse.wheel(0, -520)
    await page.waitForTimeout(1200)

    const canvas = page.getByLabel('Floating glass museum')
    await expect(canvas).toBeVisible()
    const renderer = await canvas.evaluate((element) => {
      const gl = element.getContext('webgl2')
      if (gl === null) throw new Error('WebGL2 renderer is unavailable.')
      gl.finish()
      const debug = gl.getExtension('WEBGL_debug_renderer_info')
      return {
        renderer: debug
          ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)
          : 'unavailable',
        width: element.width,
        height: element.height,
      }
    })
    const file = `${proofCase.id}.png`
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
    const canvasBounds = await canvas.boundingBox()
    if (!canvasBounds) throw new Error(`No canvas bounds for ${proofCase.id}.`)
    await viewport.evaluate((element) => {
      const adventure = element.parentElement
      if (!adventure) throw new Error('Museum viewport has no adventure host.')
      for (const sibling of adventure.children)
        if (sibling !== element)
          sibling.setAttribute('data-portrait-proof-hidden', 'true')
      const style = document.createElement('style')
      style.textContent =
        '[data-portrait-proof-hidden="true"] { visibility: hidden !important; }'
      document.head.append(style)
    })
    // Element screenshots wait for geometric stability, but the continuously
    // rendered canvas intentionally never becomes still. Clip the completed
    // WebGL frame from the page instead.
    await page.screenshot({
      path: resolve(output, file),
      clip: canvasBounds,
      animations: 'disabled',
      timeout: 90_000,
    })
    const assets = await Promise.all(observedAssets.values())
    if (!assets.some((asset) => asset.path === proofCase.texturePath))
      errors.push(`Portrait texture was not observed: ${proofCase.texturePath}`)
    if (!assets.some((asset) => asset.path.endsWith('/legend-slab.glb')))
      errors.push('Legend slab geometry was not observed.')
    if (assets.some((asset) => asset.matchesLocal === false))
      errors.push(
        'A served portrait asset differed from its local source file.',
      )
    proofs.push({
      id: proofCase.id,
      title: proofCase.title,
      url: caseUrl.href,
      screenshot: file,
      screenshotSha256: createHash('sha256')
        .update(await readFile(resolve(output, file)))
        .digest('hex'),
      ...state,
      renderer,
      assets,
      errors,
    })
    await context.close()
  }
} finally {
  await browser.close()
}

const manifest = {
  capturedAt: new Date().toISOString(),
  server: appUrl.origin,
  viewport: { width: 1024, height: 768, deviceScaleFactor: 1 },
  rasterization:
    'Actual Three/WebGL2 drawing in the shipped game; no draw methods replaced.',
  scope:
    'Visual proof of the intact final portrait prefab at its authored checkpoint; not a performance benchmark.',
  proofs,
}
await writeFile(
  resolve(output, 'manifest.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
)
console.log(
  JSON.stringify(
    proofs.map(
      ({ id, screenshot, checkpointId, renderer, assets, errors }) => ({
        id,
        screenshot,
        checkpointId,
        renderer: renderer.renderer,
        assets: assets.length,
        errors,
      }),
    ),
    null,
    2,
  ),
)
if (proofs.some((proof) => proof.errors.length > 0)) process.exitCode = 1
