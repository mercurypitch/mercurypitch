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
await mkdir(output, { recursive: true })
const assetBaseline = await cloudwayAssetBaseline({ portrait: true })
const proofCase = process.env.CLOUDWAY_PROOF_CASE ?? 'all'
if (!['all', 'integrated-v3'].includes(proofCase))
  throw new Error('CLOUDWAY_PROOF_CASE must be "all" or "integrated-v3".')
const manifestFile =
  proofCase === 'integrated-v3'
    ? 'integrated-v3-manifest.json'
    : 'camera-manifest.json'

const originalCases = [
  {
    id: 'cloudway-arrival-desktop',
    width: 1440,
    height: 900,
    checkpoint: false,
  },
  {
    id: 'cloudway-portrait-desktop',
    width: 1440,
    height: 900,
    checkpoint: true,
  },
  {
    id: 'cloudway-portrait-tablet',
    width: 1024,
    height: 768,
    checkpoint: true,
    touch: true,
  },
]
const cases =
  proofCase === 'integrated-v3'
    ? [
        {
          id: 'cloudway-v3-arrival-desktop',
          width: 1440,
          height: 900,
          checkpoint: false,
        },
        {
          id: 'cloudway-v3-portrait-tablet',
          width: 1024,
          height: 768,
          checkpoint: true,
          touch: true,
        },
      ]
    : originalCases

const browser = await chromium.launch({
  args: [
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
  ],
})
const proofs = []

const challengeCamera = async (game) => {
  const raw = await game.getAttribute('data-challenge-camera')
  return raw === null || raw === 'null' ? null : JSON.parse(raw)
}

try {
  for (const specification of cases) {
    const context = await browser.newContext({
      viewport: { width: specification.width, height: specification.height },
      hasTouch: specification.touch === true,
      reducedMotion: 'reduce',
    })
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', (error) => errors.push(`page: ${error.message}`))
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(`console: ${message.text()}`)
    })
    await page.addInitScript((checkpoint) => {
      const prefix = 'beside-cue:glass-adventure:'
      localStorage.setItem(`${prefix}tutorial`, 'seen')
      localStorage.setItem(
        `${prefix}tutorial:cloudway-glass-ribbon:cloudway-first-crossing:v1`,
        'seen',
      )
      localStorage.setItem(`${prefix}comfortable-note`, '57')
      if (checkpoint) {
        localStorage.setItem(
          `${prefix}progress:cloudway-glass-ribbon`,
          JSON.stringify({
            version: 2,
            levelId: 'cloudway-glass-ribbon',
            checkpointId: 'cloudway-checkpoint-finale',
            completedBreakableIds: [
              'cloudway-arrival-goblet',
              'cloudway-crossing-vase',
            ],
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
      navigator.mediaDevices.getUserMedia = async () => {
        const audio = new AudioContext()
        await audio.resume()
        const oscillator = audio.createOscillator()
        const gain = audio.createGain()
        gain.gain.value = 0
        oscillator.frequency.value = 220
        const destination = audio.createMediaStreamDestination()
        oscillator.connect(gain).connect(destination)
        oscillator.start()
        const track = destination.stream.getAudioTracks()[0]
        const stop = track.stop.bind(track)
        track.stop = () => {
          stop()
          oscillator.stop()
          void audio.close()
        }
        window.cloudwayCameraProofTrack = track
        return destination.stream
      }
    }, specification.checkpoint)

    try {
      console.log(`Starting ${specification.id}`)
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

      if (!specification.checkpoint) {
        await page.waitForTimeout(1500)
        const file = `${specification.id}.png`
        await page.screenshot({ path: `${output}/${file}`, timeout: 90_000 })
        proofs.push({
          case: specification.id,
          viewport: {
            width: specification.width,
            height: specification.height,
          },
          checkpoint: await game.getAttribute('data-checkpoint'),
          file,
          errors,
        })
        assert.deepEqual(errors, [])
        console.log(`Captured ${specification.id}`)
        continue
      }

      assert.equal(
        await game.getAttribute('data-checkpoint'),
        'cloudway-checkpoint-finale',
      )
      const sing = page.getByRole('button', { name: 'Sing to the glass' })
      if (!(await sing.isVisible())) {
        await page.keyboard.down('KeyW')
        try {
          await sing.waitFor({ state: 'visible', timeout: 30_000 })
        } finally {
          await page.keyboard.up('KeyW')
        }
      }
      if (specification.touch) await sing.tap()
      else await page.keyboard.press('KeyF')

      const panel = page.getByLabel('Voice challenge', { exact: true })
      await panel.waitFor({ state: 'visible', timeout: 20_000 })
      await page.waitForFunction(
        () => {
          const game = document.querySelector('[data-testid="glass-adventure"]')
          const raw = game?.getAttribute('data-challenge-camera')
          if (raw === null || raw === undefined || raw === 'null') return false
          const camera = JSON.parse(raw)
          return camera.mode === 'holding' && camera.settled === true
        },
        undefined,
        { timeout: 90_000 },
      )
      await page.waitForTimeout(500)

      const camera = await challengeCamera(game)
      assert(camera !== null)
      assert.equal(camera.mode, 'holding')
      assert.equal(camera.settled, true)
      assert(camera.position.y > 0.65, `camera too low: ${camera.position.y}`)
      assert(
        camera.position.z < 30.5,
        `camera is behind the portrait: ${camera.position.z}`,
      )
      assert(camera.mercFrame !== null)
      assert(camera.targetFrame !== null)
      assert(camera.combinedFrame !== null)
      assert(camera.combinedFrame.minX >= -0.9)
      assert(camera.combinedFrame.maxX <= 0.9)
      assert(camera.combinedFrame.maxY <= 0.88)
      assert(camera.combinedFrame.minY >= camera.safeBottomNdc - 0.01)
      const overlap = Math.max(
        0,
        Math.min(camera.mercFrame.maxX, camera.targetFrame.maxX) -
          Math.max(camera.mercFrame.minX, camera.targetFrame.minX),
      )
      const narrower = Math.min(
        camera.mercFrame.maxX - camera.mercFrame.minX,
        camera.targetFrame.maxX - camera.targetFrame.minX,
      )
      const overlapRatio = overlap / narrower
      assert(
        overlapRatio <= 0.2,
        `portrait occluded by Merc: overlap ratio ${overlapRatio}`,
      )

      const panelBounds = await panel.boundingBox()
      assert(panelBounds !== null)
      const file = `${specification.id}-singing.png`
      await page.screenshot({ path: `${output}/${file}`, timeout: 90_000 })
      proofs.push({
        case: specification.id,
        viewport: {
          width: specification.width,
          height: specification.height,
        },
        checkpoint: await game.getAttribute('data-checkpoint'),
        camera,
        overlapRatio,
        panelBounds,
        file,
        errors,
      })
      assert.deepEqual(errors, [])
      console.log(`Captured ${specification.id}`)
    } finally {
      await page
        .evaluate(() => window.cloudwayCameraProofTrack?.stop())
        .catch(() => undefined)
      await context.close()
    }
  }
} finally {
  await browser.close()
  await writeFile(
    `${output}/${manifestFile}`,
    `${JSON.stringify(
      {
        capturedAt: new Date().toISOString(),
        url: source.href,
        rendering:
          'Real WebGL2 raster through SwiftShader; no draw suppression or canvas resizing.',
        proofScope:
          proofCase === 'integrated-v3'
            ? 'Final Cloudway V3 runtime integration appearance proof: fresh arrival and seeded tablet finale challenge.'
            : 'Development renderer appearance proof with a seeded saved checkpoint for the finale.',
        limitations:
          'This opens the Cloudway development layout directly. It does not prove campaign unlocking, physical-device performance or traversal to the finale.',
        assetBaseline,
        proofs,
      },
      null,
      2,
    )}\n`,
  )
}
