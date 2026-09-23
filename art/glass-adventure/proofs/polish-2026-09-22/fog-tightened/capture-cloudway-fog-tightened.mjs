// Capture Cloudway reveal distance at arrival, midroute and the widest oblique exploration view.
import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { cloudwayAssetBaseline } from '../proof-assets.mjs'

const repositoryRoot = new URL('../../../../../', import.meta.url)
const require = createRequire(new URL('package.json', repositoryRoot))
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
const label = process.env.CLOUDWAY_PROOF_LABEL ?? 'tightened'
if (!/^[a-z0-9-]+$/.test(label))
  throw new Error('CLOUDWAY_PROOF_LABEL must use lowercase letters and dashes.')
await mkdir(output, { recursive: true })

const sceneSource = await readFile(
  new URL('packages/glass-game/src/render/cloudway-scene.ts', repositoryRoot),
  'utf8',
)
const fogNumber = (name) => {
  const match = sceneSource.match(
    new RegExp(`export const ${name} = ([0-9.]+)`),
  )
  if (match === null) throw new Error(`Could not read ${name}.`)
  return Number(match[1])
}
const fogPolicy = {
  near: fogNumber('CLOUDWAY_FOG_NEAR'),
  far: fogNumber('CLOUDWAY_FOG_FAR'),
  distance: 'radial camera-space distance',
}
const assetBaseline = await cloudwayAssetBaseline()

const cases = [
  {
    id: 'arrival',
    checkpoint: 'cloudway-checkpoint-arrival',
    completedBreakableIds: [],
  },
  {
    id: 'raft-approach',
    checkpoint: 'cloudway-checkpoint-frost-catch',
    completedBreakableIds: ['cloudway-arrival-goblet'],
  },
  {
    id: 'midroute',
    checkpoint: 'cloudway-checkpoint-glide-east',
    completedBreakableIds: [
      'cloudway-arrival-goblet',
      'cloudway-crossing-vase',
    ],
  },
  {
    id: 'arrival-orbit-zoom-out',
    checkpoint: 'cloudway-checkpoint-arrival',
    completedBreakableIds: [],
    orbitYawOffset: -0.58,
    wheelDeltaY: 2000,
    expectedBoomDistance: 6.5,
  },
  {
    id: 'arrival-orbit-zoom-in',
    checkpoint: 'cloudway-checkpoint-arrival',
    completedBreakableIds: [],
    orbitYawOffset: 0.58,
    wheelDeltaY: -2000,
    expectedBoomDistance: 1.8,
  },
]

const browser = await chromium.launch({
  args: [
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
  ],
})
const evidence = []

try {
  for (const specification of cases) {
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
    await page.addInitScript((saved) => {
      const prefix = 'beside-cue:glass-adventure:'
      localStorage.setItem(`${prefix}tutorial`, 'seen')
      localStorage.setItem(
        `${prefix}tutorial:cloudway-glass-ribbon:cloudway-first-crossing:v1`,
        'seen',
      )
      localStorage.setItem(`${prefix}comfortable-note`, '57')
      if (saved.checkpoint !== 'cloudway-checkpoint-arrival') {
        localStorage.setItem(
          `${prefix}progress:cloudway-glass-ribbon`,
          JSON.stringify({
            version: 2,
            levelId: 'cloudway-glass-ribbon',
            checkpointId: saved.checkpoint,
            completedBreakableIds: saved.completedBreakableIds,
            finished: false,
            rewards: {
              version: 1,
              discoveredEncounterIds: [],
              collectedCoinIds: [],
              collectedPortraitIds: [],
              qualityResults: [],
            },
          }),
        )
      }
    }, specification)

    try {
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
        specification.checkpoint,
      )

      const authoredYaw = Number(await game.getAttribute('data-camera-yaw'))
      if (specification.orbitYawOffset !== undefined) {
        const viewport = page.getByLabel('Glass museum; drag to look around')
        const bounds = await viewport.boundingBox()
        if (bounds === null) throw new Error('Missing museum viewport bounds.')
        const dragX = -specification.orbitYawOffset / 0.005
        await page.mouse.move(
          bounds.x + bounds.width / 2,
          bounds.y + bounds.height / 2,
        )
        await page.mouse.down()
        await page.mouse.move(
          bounds.x + bounds.width / 2 + dragX,
          bounds.y + bounds.height / 2,
          { steps: 12 },
        )
        await page.mouse.up()
        await page.mouse.wheel(0, specification.wheelDeltaY)
      }
      await page.evaluate(
        () =>
          new Promise((resolve) => {
            let remaining = 30
            const frame = () =>
              --remaining <= 0 ? resolve() : requestAnimationFrame(frame)
            requestAnimationFrame(frame)
          }),
      )

      const file = `${label}-${specification.id}.png`
      await page.screenshot({ path: `${output}/${file}`, timeout: 90_000 })
      const raster = await page
        .locator('canvas[aria-label="Floating glass museum"]')
        .evaluate((element) => {
          const bounds = element.getBoundingClientRect()
          return {
            cssWidth: bounds.width,
            cssHeight: bounds.height,
            pixelWidth: element.width,
            pixelHeight: element.height,
            devicePixelRatio: window.devicePixelRatio,
          }
        })
      evidence.push({
        id: specification.id,
        checkpoint: specification.checkpoint,
        player: {
          x: Number(await game.getAttribute('data-player-x')),
          y: Number(await game.getAttribute('data-player-y')),
          z: Number(await game.getAttribute('data-player-z')),
        },
        action:
          specification.orbitYawOffset === undefined
            ? { kind: 'authored-camera' }
            : {
                kind: 'real-mouse-orbit-and-wheel',
                yawOffset: specification.orbitYawOffset,
                wheelDeltaY: specification.wheelDeltaY,
                expectedBoomDistance: specification.expectedBoomDistance,
              },
        authoredYaw,
        capturedYaw: Number(await game.getAttribute('data-camera-yaw')),
        raster,
        file,
        errors,
      })
      assert.deepEqual(errors, [])
    } finally {
      await context.close()
    }
  }
} finally {
  await browser.close()
}

await writeFile(
  `${output}/${label}-manifest.json`,
  `${JSON.stringify(
    {
      capturedAt: new Date().toISOString(),
      url: source.href,
      rendering:
        'Real WebGL2 raster through SwiftShader at devicePixelRatio 1.5; no draw suppression or canvas resizing.',
      proofScope:
        'Cloudway exploration reveal-distance comparison at arrival, seeded raft and warning approaches, and both exploration zoom limits.',
      limitations:
        'Appearance evidence from the direct development layout; the midroute frame uses a seeded checkpoint and is not a traversal claim.',
      fogPolicy,
      assetBaseline,
      evidence,
    },
    null,
    2,
  )}\n`,
)
