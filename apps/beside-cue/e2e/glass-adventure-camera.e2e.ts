// Challenge camera browser smoke — live panel-safe framing, input lock and return.

import { expect, test, type Page } from '@playwright/test'

interface CameraMetrics {
  mode: 'exploration' | 'entering' | 'holding' | 'restoring'
  settled: boolean
  safeBottomFraction: number
  position: { x: number; y: number; z: number }
  mercFrame: { minX: number; maxX: number; minY: number; maxY: number } | null
  targetFrame: { minX: number; maxX: number; minY: number; maxY: number } | null
  combinedFrame: {
    minX: number
    maxX: number
    minY: number
    maxY: number
  } | null
  safeBottomNdc: number | null
}

declare global {
  interface Window {
    cameraVoiceTrack?: MediaStreamTrack
    cameraVoiceGain?: GainNode
  }
}

test.use({
  viewport: { width: 640, height: 480 },
  hasTouch: true,
  launchOptions: {
    args: [
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
    ],
  },
})
test.setTimeout(240_000)

async function metrics(page: Page): Promise<CameraMetrics> {
  const raw = await page
    .getByTestId('glass-adventure')
    .getAttribute('data-challenge-camera')
  if (raw === null || raw === 'null') throw new Error('Missing camera metrics.')
  return JSON.parse(raw) as CameraMetrics
}

async function settledCameraMetrics(page: Page): Promise<CameraMetrics> {
  let previous = await metrics(page)
  for (let attempt = 0; attempt < 12; attempt++) {
    await page.waitForTimeout(150)
    const current = await metrics(page)
    const distance = Math.hypot(
      current.position.x - previous.position.x,
      current.position.y - previous.position.y,
      current.position.z - previous.position.z,
    )
    if (current.mode === 'exploration' && distance < 0.002) return current
    previous = current
  }
  throw new Error('Exploration camera did not settle.')
}

async function settledChallengeMetrics(page: Page): Promise<CameraMetrics> {
  await expect
    .poll(
      async () => {
        const current = await metrics(page)
        return current.mode === 'holding' && current.settled
      },
      { timeout: 30_000, intervals: [100] },
    )
    .toBe(true)
  return metrics(page)
}

async function installCameraVoice(page: Page): Promise<void> {
  await page.addInitScript(() => {
    // This spec asserts camera metrics and input behavior. Pixel output has
    // separate compiled screenshot proofs, so skip costly SwiftShader draws.
    for (const method of [
      'clear',
      'drawArrays',
      'drawArraysInstanced',
      'drawElements',
      'drawElementsInstanced',
    ])
      Object.defineProperty(WebGL2RenderingContext.prototype, method, {
        configurable: true,
        value: () => undefined,
      })
    const prefix = 'beside-cue:glass-adventure:'
    localStorage.setItem(`${prefix}tutorial`, 'seen')
    localStorage.setItem(`${prefix}comfortable-note`, '57')
    localStorage.setItem(
      `${prefix}progress:glassworks`,
      JSON.stringify({
        version: 1,
        levelId: 'glassworks',
        checkpointId: 'goblet',
        completedBreakableIds: [],
      }),
    )
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
      window.cameraVoiceGain = gain
      window.cameraVoiceTrack = track
      return destination.stream
    }
  })
}

test.afterEach(async ({ page }) => {
  await page.evaluate(() => window.cameraVoiceTrack?.stop()).catch(() => {})
})

test('frames Merc and the exhibit above the phone panel and restores after cancel @smoke', async ({
  page,
}) => {
  await installCameraVoice(page)
  await page.goto('/glass-game/')
  const adventure = page.getByTestId('glass-adventure')
  await expect(adventure).toHaveAttribute('data-ready', 'true', {
    timeout: 40_000,
  })
  await expect(
    page.getByRole('button', { name: 'Sing to the glass' }),
  ).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  const movementControls = page.getByLabel('Movement controls', {
    exact: true,
  })
  await expect(movementControls).toBeVisible()
  const before = await settledCameraMetrics(page)

  await page.keyboard.press('KeyF')
  const panel = page.getByLabel('Voice challenge', { exact: true })
  await expect(panel).toHaveAttribute('data-voice-mode', 'singing', {
    timeout: 20_000,
  })
  await expect(adventure).toHaveAttribute(
    'data-challenge-camera-mode',
    'holding',
    { timeout: 30_000 },
  )
  await expect(movementControls).toBeHidden()
  const held = await settledChallengeMetrics(page)
  const panelBounds = await panel.boundingBox()
  expect(panelBounds).not.toBeNull()
  expect(held.safeBottomFraction).toBeGreaterThan(0.2)
  expect(held.mercFrame).not.toBeNull()
  expect(held.targetFrame).not.toBeNull()
  expect(held.combinedFrame!.minX).toBeGreaterThanOrEqual(-0.9)
  expect(held.combinedFrame!.maxX).toBeLessThanOrEqual(0.9)
  expect(held.combinedFrame!.minY).toBeGreaterThanOrEqual(
    (held.safeBottomNdc ?? -1) - 0.01,
  )
  expect(held.combinedFrame!.maxY).toBeLessThanOrEqual(0.88)

  const viewport = page.getByLabel('Glass museum; drag to look around')
  const viewportBounds = await viewport.boundingBox()
  if (viewportBounds === null) throw new Error('Missing museum viewport.')
  await page.mouse.move(
    viewportBounds.x + viewportBounds.width * 0.5,
    viewportBounds.y + viewportBounds.height * 0.35,
  )
  await page.mouse.down()
  await page.mouse.move(
    viewportBounds.x + viewportBounds.width * 0.8,
    viewportBounds.y + viewportBounds.height * 0.2,
    { steps: 8 },
  )
  await page.mouse.wheel(0, 500)
  await page.mouse.up()
  const afterInput = await settledChallengeMetrics(page)
  expect(afterInput.mode).toBe('holding')
  expect(afterInput.position.x).toBeCloseTo(held.position.x, 3)
  expect(afterInput.position.y).toBeCloseTo(held.position.y, 3)
  expect(afterInput.position.z).toBeCloseTo(held.position.z, 3)

  await panel.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(adventure).toHaveAttribute(
    'data-challenge-camera-mode',
    'exploration',
    { timeout: 30_000 },
  )
  const returned = await settledCameraMetrics(page)
  expect(returned.position.x).toBeCloseTo(before.position.x, 3)
  expect(returned.position.y).toBeCloseTo(before.position.y, 3)
  expect(returned.position.z).toBeCloseTo(before.position.z, 3)
  await expect(movementControls).toBeVisible()
})

test('tap entry holds the shot through the full shatter before restoring @smoke', async ({
  page,
}) => {
  await installCameraVoice(page)
  await page.goto('/glass-game/')
  const adventure = page.getByTestId('glass-adventure')
  await expect(adventure).toHaveAttribute('data-ready', 'true', {
    timeout: 40_000,
  })
  const sing = page.getByRole('button', { name: 'Sing to the glass' })
  const movementControls = page.getByLabel('Movement controls', {
    exact: true,
  })
  await expect(sing).toBeVisible()
  await expect(movementControls).toBeVisible()
  const before = await settledCameraMetrics(page)
  await sing.tap()
  const panel = page.getByLabel('Voice challenge', { exact: true })
  await expect(panel).toHaveAttribute('data-voice-mode', 'singing', {
    timeout: 20_000,
  })
  await expect(adventure).toHaveAttribute(
    'data-challenge-camera-mode',
    'holding',
    { timeout: 30_000 },
  )
  await expect(movementControls).toBeHidden()

  await page.evaluate(() => {
    const gain = window.cameraVoiceGain
    if (gain === undefined) throw new Error('Missing microphone gain.')
    gain.gain.setValueAtTime(0.1, gain.context.currentTime)
  })
  await expect(adventure).toHaveAttribute('data-completed', '1', {
    timeout: 20_000,
  })
  await expect(movementControls).toBeHidden()
  await expect(adventure).toHaveAttribute(
    'data-challenge-camera-mode',
    'holding',
  )
  await expect(adventure).toHaveAttribute(
    'data-challenge-camera-mode',
    'restoring',
    { timeout: 20_000 },
  )
  await expect(adventure).toHaveAttribute(
    'data-challenge-camera-mode',
    'exploration',
    { timeout: 90_000 },
  )
  const returned = await settledCameraMetrics(page)
  expect(returned.position.x).toBeCloseTo(before.position.x, 3)
  expect(returned.position.y).toBeCloseTo(before.position.y, 3)
  expect(returned.position.z).toBeCloseTo(before.position.z, 3)
  await expect(movementControls).toBeVisible()
})
